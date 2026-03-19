import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getMercadoPagoMerchantOrder,
  getMercadoPagoPayment,
  getMercadoPagoPreference,
  getMercadoPagoWebhookSecret,
  getMercadoPagoWebhookSecurityMode,
  isMercadoPagoConfigured,
  type MercadoPagoMerchantOrderResponse,
  type MercadoPagoPaymentResponse,
  type MercadoPagoPreferenceResponse,
} from "@/lib/mercadopago";
import { isProductionRuntime } from "@/lib/env";
import { canTransitionOrderStatus } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

const webhookNotificationSchema = z
  .object({
    action: z.string().optional(),
    api_version: z.string().optional(),
    application_id: z.union([z.string(), z.number()]).optional(),
    data: z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
      })
      .optional(),
    date_created: z.string().optional(),
    id: z.union([z.string(), z.number()]).optional(),
    live_mode: z.boolean().optional(),
    topic: z.string().optional(),
    type: z.string().optional(),
    user_id: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

type OrdersRow = Database["public"]["Tables"]["orders"]["Row"];
type OrdersUpdate = Database["public"]["Tables"]["orders"]["Update"];

type NotificationTopic =
  | "payment"
  | "merchant_order"
  | "preference"
  | "unknown";

type ReconciliationResult = {
  orderId: string | null;
  action: "updated" | "noop" | "ignored";
  reason: string;
  mpStatus?: string | null;
  status?: OrdersRow["status"];
  mpPaymentId?: string | null;
};

function normalizeTopic(value: string | null | undefined): NotificationTopic {
  switch (value) {
    case "payment":
      return "payment";
    case "merchant_order":
      return "merchant_order";
    case "preference":
      return "preference";
    default:
      return "unknown";
  }
}

function getNotificationTopic(
  request: NextRequest,
  payload: z.infer<typeof webhookNotificationSchema>,
): NotificationTopic {
  return normalizeTopic(
    payload.type ??
      payload.topic ??
      request.nextUrl.searchParams.get("type") ??
      request.nextUrl.searchParams.get("topic"),
  );
}

function getNotificationResourceId(
  request: NextRequest,
  payload: z.infer<typeof webhookNotificationSchema>,
): string | null {
  const directId =
    payload.data?.id ??
    payload.id ??
    request.nextUrl.searchParams.get("data.id") ??
    request.nextUrl.searchParams.get("id");

  if (directId !== undefined && directId !== null) {
    return String(directId);
  }

  const resource = request.nextUrl.searchParams.get("resource");

  if (!resource) {
    return null;
  }

  const match = resource.match(/\/(\d+)(?:\?.*)?$/);
  return match?.[1] ?? null;
}

/**
 * Verify webhook signature following Mercado Pago official docs EXACTLY.
 *
 * Doc says:
 * 1. Extract ts and v1 from x-signature header
 * 2. Build manifest template: id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
 *    - data.id comes from query param "data.id" (NOT "id", NOT body)
 *    - If any value is NOT present in the notification, REMOVE it from template
 * 3. HMAC-SHA256(secret, manifest) must equal v1
 */
function verifyWebhookSignature(request: NextRequest) {
  const secret = getMercadoPagoWebhookSecret();

  if (!secret) {
    return {
      ok: true,
      mode: "skipped",
      reason: "missing_webhook_secret",
      requestId: request.headers.get("x-request-id"),
    } as const;
  }

  // Step 1: Extract x-signature header
  const xSignatureRaw = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  if (!xSignatureRaw) {
    return {
      ok: false,
      mode: "enforced",
      reason: "missing_signature_headers",
      requestId: xRequestId,
    } as const;
  }

  // Parse ts and v1 from x-signature
  const parts = xSignatureRaw.split(",");
  let ts: string | undefined;
  let hash: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key && value) {
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      if (trimmedKey === "ts") ts = trimmedValue;
      else if (trimmedKey === "v1") hash = trimmedValue;
    }
  }

  if (!ts || !hash) {
    return {
      ok: false,
      mode: "enforced",
      reason: "missing_signature_headers",
      requestId: xRequestId,
    } as const;
  }

  // Step 2: Build manifest from query params (doc says data.id from query, NOT "id")
  const dataID = request.nextUrl.searchParams.get("data.id");

  // Template: id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
  // "Si alguno de los valores no está presente, debes removerlo"
  let manifest = "";
  if (dataID) manifest += `id:${dataID};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  // Step 3: HMAC-SHA256
  const cyphedSignature = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const isValid = cyphedSignature === hash;

  if (!isValid) {
    console.warn("Mercado Pago webhook signature debug", {
      manifest,
      computed: cyphedSignature,
      received: hash,
      dataID,
      xRequestId,
      ts,
      xSignatureRaw,
      secretFirstChars: secret.substring(0, 6) + "...",
      url: request.url,
    });
  }

  return {
    ok: isValid,
    mode: "enforced",
    reason: isValid ? "verified" : "signature_mismatch",
    requestId: xRequestId,
  } as const;
}

function normalizePaymentStatus(status: string | undefined) {
  return status?.trim().toLowerCase() ?? null;
}

const KNOWN_PAYMENT_STATUSES = new Set([
  "approved",
  "authorized",
  "pending",
  "in_process",
  "in_mediation",
  "action_required",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
]);

function mapPaymentMpStatus(payment: MercadoPagoPaymentResponse): string {
  const status = normalizePaymentStatus(payment.status);
  const statusDetail = normalizePaymentStatus(payment.status_detail);

  if (status && statusDetail && status !== statusDetail) {
    return `${status}:${statusDetail}`;
  }

  if (status) {
    return status;
  }

  if (statusDetail) {
    return statusDetail;
  }

  return "payment_unknown";
}

function mapMerchantOrderMpStatus(
  merchantOrder: MercadoPagoMerchantOrderResponse,
): string {
  return `merchant_order:${merchantOrder.order_status ?? merchantOrder.status ?? "unknown"}`;
}

function chooseBusinessStatusFromPayment(
  currentStatus: OrdersRow["status"],
  paymentStatus: string | undefined,
): OrdersRow["status"] {
  const normalized = normalizePaymentStatus(paymentStatus);

  if (!normalized) {
    return currentStatus;
  }

  if (["approved", "authorized"].includes(normalized)) {
    return canTransitionOrderStatus(currentStatus, "paid")
      ? "paid"
      : currentStatus;
  }

  if (
    ["pending", "in_process", "in_mediation", "action_required"].includes(
      normalized,
    )
  ) {
    return currentStatus;
  }

  if (
    ["rejected", "cancelled", "refunded", "charged_back"].includes(normalized)
  ) {
    return canTransitionOrderStatus(currentStatus, "cancelled")
      ? "cancelled"
      : currentStatus;
  }

  return currentStatus;
}

async function findOrderForReconciliation(params: {
  admin: ReturnType<typeof createAdminClient>;
  orderId?: string | null;
  mpPaymentId?: string | null;
  mpPreferenceId?: string | null;
}) {
  const { admin, orderId, mpPaymentId, mpPreferenceId } = params;

  if (orderId) {
    const { data } = await admin
      .from("orders")
      .select("id, status, mp_status, mp_payment_id, mp_preference_id")
      .eq("id", orderId)
      .maybeSingle();

    if (data) {
      return data;
    }
  }

  if (mpPaymentId) {
    const { data } = await admin
      .from("orders")
      .select("id, status, mp_status, mp_payment_id, mp_preference_id")
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle();

    if (data) {
      return data;
    }
  }

  if (mpPreferenceId) {
    const { data } = await admin
      .from("orders")
      .select("id, status, mp_status, mp_payment_id, mp_preference_id")
      .eq("mp_preference_id", mpPreferenceId)
      .maybeSingle();

    if (data) {
      return data;
    }
  }

  return null;
}

async function updateOrderIfNeeded(
  admin: ReturnType<typeof createAdminClient>,
  order: Pick<
    OrdersRow,
    "id" | "status" | "mp_status" | "mp_payment_id" | "mp_preference_id"
  >,
  update: OrdersUpdate,
): Promise<ReconciliationResult> {
  const entries = Object.entries(update).filter(
    ([, value]) => value !== undefined,
  );

  if (entries.length === 0) {
    return {
      orderId: order.id,
      action: "noop",
      reason: "idempotent_replay",
      mpStatus: order.mp_status,
      status: order.status,
      mpPaymentId: order.mp_payment_id,
    };
  }

  const { data, error } = await admin
    .from("orders")
    .update(update)
    .eq("id", order.id)
    .eq("status", order.status)
    .select("id, status, mp_status, mp_payment_id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update order ${order.id}: ${error.message}`);
  }

  if (!data) {
    const { data: latestOrder, error: latestOrderError } = await admin
      .from("orders")
      .select("id, status, mp_status, mp_payment_id")
      .eq("id", order.id)
      .maybeSingle();

    if (latestOrderError || !latestOrder) {
      throw new Error(
        `Failed to reload order ${order.id} after reconciliation race: ${latestOrderError?.message ?? "missing order"}`,
      );
    }

    return {
      orderId: latestOrder.id,
      action: "noop",
      reason: "concurrent_reconciliation",
      mpStatus: latestOrder.mp_status,
      status: latestOrder.status,
      mpPaymentId: latestOrder.mp_payment_id,
    };
  }

  return {
    orderId: data.id,
    action: "updated",
    reason: "order_reconciled",
    mpStatus: data.mp_status,
    status: data.status,
    mpPaymentId: data.mp_payment_id,
  };
}

async function reconcilePayment(
  admin: ReturnType<typeof createAdminClient>,
  payment: MercadoPagoPaymentResponse,
  mpPreferenceId?: string | null,
): Promise<ReconciliationResult> {
  const mpPaymentId = payment.id ? String(payment.id) : null;
  const normalizedPaymentStatus = normalizePaymentStatus(payment.status);

  if (
    normalizedPaymentStatus &&
    !KNOWN_PAYMENT_STATUSES.has(normalizedPaymentStatus)
  ) {
    console.warn("Mercado Pago payment arrived with unmapped status", {
      paymentId: mpPaymentId,
      status: normalizedPaymentStatus,
      statusDetail: normalizePaymentStatus(payment.status_detail),
    });
  }

  const externalReference = payment.external_reference?.trim() || null;
  const metadataOrderId =
    payment.metadata &&
    typeof payment.metadata === "object" &&
    "order_id" in payment.metadata
      ? String((payment.metadata as Record<string, unknown>).order_id)
      : null;
  const resolvedOrder = await findOrderForReconciliation({
    admin,
    orderId: externalReference ?? metadataOrderId,
    mpPaymentId,
    mpPreferenceId,
  });

  if (!resolvedOrder) {
    return {
      orderId: externalReference ?? metadataOrderId,
      action: "ignored",
      reason: "order_not_found",
      mpStatus: mapPaymentMpStatus(payment),
      mpPaymentId,
    };
  }

  const nextMpStatus = mapPaymentMpStatus(payment);
  const nextStatus = chooseBusinessStatusFromPayment(
    resolvedOrder.status,
    normalizedPaymentStatus ?? undefined,
  );

  return updateOrderIfNeeded(admin, resolvedOrder, {
    mp_status:
      resolvedOrder.mp_status === nextMpStatus ? undefined : nextMpStatus,
    mp_payment_id:
      resolvedOrder.mp_payment_id === mpPaymentId ? undefined : mpPaymentId,
    mp_preference_id:
      mpPreferenceId && resolvedOrder.mp_preference_id !== mpPreferenceId
        ? mpPreferenceId
        : undefined,
    status: resolvedOrder.status === nextStatus ? undefined : nextStatus,
  });
}

function selectBestMerchantOrderPayment(
  merchantOrder: MercadoPagoMerchantOrderResponse,
): string | null {
  const payments =
    merchantOrder.payments?.filter((payment) => payment.id !== undefined) ?? [];

  if (payments.length === 0) {
    return null;
  }

  const ranked = [...payments].sort((left, right) => {
    const weight = (status?: string) => {
      if (status === "approved" || status === "authorized") {
        return 3;
      }

      if (status === "pending" || status === "in_process") {
        return 2;
      }

      return 1;
    };

    return weight(right.status) - weight(left.status);
  });

  return ranked[0]?.id ? String(ranked[0].id) : null;
}

async function reconcileMerchantOrder(
  admin: ReturnType<typeof createAdminClient>,
  merchantOrder: MercadoPagoMerchantOrderResponse,
): Promise<ReconciliationResult> {
  const mpPreferenceId = merchantOrder.preference_id ?? null;
  const paymentId = selectBestMerchantOrderPayment(merchantOrder);

  if (paymentId) {
    const payment = await getMercadoPagoPayment(paymentId);
    return reconcilePayment(admin, payment, mpPreferenceId);
  }

  const resolvedOrder = await findOrderForReconciliation({
    admin,
    orderId: merchantOrder.external_reference ?? null,
    mpPreferenceId,
  });

  if (!resolvedOrder) {
    return {
      orderId: merchantOrder.external_reference ?? null,
      action: "ignored",
      reason: "order_not_found",
      mpStatus: mapMerchantOrderMpStatus(merchantOrder),
    };
  }

  return updateOrderIfNeeded(admin, resolvedOrder, {
    mp_preference_id:
      mpPreferenceId && resolvedOrder.mp_preference_id !== mpPreferenceId
        ? mpPreferenceId
        : undefined,
    mp_status:
      resolvedOrder.mp_status === mapMerchantOrderMpStatus(merchantOrder)
        ? undefined
        : mapMerchantOrderMpStatus(merchantOrder),
  });
}

async function reconcilePreference(
  admin: ReturnType<typeof createAdminClient>,
  preference: MercadoPagoPreferenceResponse,
): Promise<ReconciliationResult> {
  const preferenceId = preference.id ?? null;
  const resolvedOrder = await findOrderForReconciliation({
    admin,
    orderId: preference.external_reference ?? null,
    mpPreferenceId: preferenceId,
  });

  if (!resolvedOrder) {
    return {
      orderId: preference.external_reference ?? null,
      action: "ignored",
      reason: "order_not_found",
    };
  }

  return updateOrderIfNeeded(admin, resolvedOrder, {
    mp_preference_id:
      preferenceId && resolvedOrder.mp_preference_id !== preferenceId
        ? preferenceId
        : undefined,
    mp_status:
      resolvedOrder.mp_status &&
      !resolvedOrder.mp_status.startsWith("preference")
        ? undefined
        : "preference_created",
  });
}

export async function POST(request: NextRequest) {
  if (!isMercadoPagoConfigured()) {
    console.error(
      "Mercado Pago webhook received without server credentials configured.",
    );
    return NextResponse.json(
      { error: "Mercado Pago is not configured." },
      { status: 500 },
    );
  }

  const webhookSecurityMode = getMercadoPagoWebhookSecurityMode();

  if (webhookSecurityMode === "misconfigured_production") {
    console.error(
      "Mercado Pago webhook rejected because signature verification is not configured.",
      {
        mode: webhookSecurityMode,
        reason: "missing_webhook_secret",
      },
    );

    return NextResponse.json(
      {
        received: false,
        reason: "webhook_signature_not_configured",
      },
      { status: 503 },
    );
  }

  const rawText = await request.text();
  const jsonPayload = rawText
    ? (() => {
        try {
          return JSON.parse(rawText);
        } catch {
          return null;
        }
      })()
    : {};
  const parsed = webhookNotificationSchema.safeParse(jsonPayload);

  if (!parsed.success) {
    console.error("Mercado Pago webhook payload rejected", {
      issues: parsed.error.issues,
      body: rawText,
    });

    return NextResponse.json(
      { received: false, reason: "invalid_payload" },
      { status: 400 },
    );
  }

  const topic = getNotificationTopic(request, parsed.data);
  const resourceId = getNotificationResourceId(request, parsed.data);
  const requestId = request.headers.get("x-request-id");
  const notificationId = parsed.data.id ? String(parsed.data.id) : null;

  console.info("Mercado Pago webhook received", {
    topic,
    resourceId,
    notificationId,
    requestId,
    mode: webhookSecurityMode,
  });

  if (topic === "unknown" || !resourceId) {
    console.warn(
      "Mercado Pago webhook ignored because topic or resource id is missing",
      {
        topic,
        resourceId,
        payload: parsed.data,
      },
    );

    return NextResponse.json(
      { received: true, ignored: true },
      { status: 202 },
    );
  }

  const signatureCheck = verifyWebhookSignature(request);

  if (!signatureCheck.ok) {
    if (isProductionRuntime()) {
      console.error("Mercado Pago webhook signature validation failed", {
        topic,
        resourceId,
        notificationId,
        requestId: signatureCheck.requestId,
        reason: signatureCheck.reason,
        hasSignatureHeader: Boolean(request.headers.get("x-signature")),
      });

      return NextResponse.json(
        { received: false, reason: signatureCheck.reason },
        { status: 401 },
      );
    }

    console.warn("Mercado Pago webhook signature mismatch tolerated in development", {
      topic,
      resourceId,
      notificationId,
      requestId: signatureCheck.requestId,
      reason: signatureCheck.reason,
    });
  }

  if (signatureCheck.mode === "skipped") {
    console.warn(
      "Mercado Pago webhook signature verification running in development fallback mode",
      {
        topic,
        resourceId,
        notificationId,
        requestId: signatureCheck.requestId,
        reason: signatureCheck.reason,
      },
    );
  }

  try {
    const admin = createAdminClient();
    let result: ReconciliationResult;

    switch (topic) {
      case "payment": {
        const payment = await getMercadoPagoPayment(resourceId);
        result = await reconcilePayment(admin, payment);
        break;
      }
      case "merchant_order": {
        const merchantOrder = await getMercadoPagoMerchantOrder(resourceId);
        result = await reconcileMerchantOrder(admin, merchantOrder);
        break;
      }
      case "preference": {
        const preference = await getMercadoPagoPreference(resourceId);
        result = await reconcilePreference(admin, preference);
        break;
      }
      default: {
        result = {
          orderId: null,
          action: "ignored",
          reason: "unsupported_topic",
        };
      }
    }

    if (result.action === "ignored") {
      console.warn("Mercado Pago webhook could not reconcile an order", {
        topic,
        resourceId,
        notificationId,
        requestId,
        orderId: result.orderId,
        reason: result.reason,
        mpStatus: result.mpStatus,
        mpPaymentId: result.mpPaymentId,
      });
    } else {
      console.info("Mercado Pago webhook reconciled", {
        topic,
        resourceId,
        notificationId,
        requestId,
        orderId: result.orderId,
        action: result.action,
        reason: result.reason,
        status: result.status,
        mpStatus: result.mpStatus,
        mpPaymentId: result.mpPaymentId,
      });
    }

    return NextResponse.json({
      received: true,
      topic,
      resourceId,
      orderId: result.orderId,
      action: result.action,
      reason: result.reason,
      mpStatus: result.mpStatus ?? null,
      status: result.status ?? null,
      mpPaymentId: result.mpPaymentId ?? null,
    });
  } catch (error) {
    console.error("Mercado Pago webhook reconciliation failed", {
      topic,
      resourceId,
      notificationId,
      requestId,
      error,
    });

    return NextResponse.json(
      { received: false, reason: "reconciliation_failed" },
      { status: 500 },
    );
  }
}
