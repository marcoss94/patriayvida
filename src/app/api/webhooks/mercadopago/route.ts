import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildMercadoPagoManifest,
  normalizeMercadoPagoNotificationTopic,
  parseMercadoPagoSignatureHeader,
  resolveMercadoPagoWebhookRouteDecision,
  verifyMercadoPagoSignature,
  type MercadoPagoNotificationTopic,
} from "@/lib/mercadopago-webhook";
import {
  getMercadoPagoMerchantOrder,
  getMercadoPagoPayment,
  getMercadoPagoPreference,
  getMercadoPagoWebhookSecrets,
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

type ReconciliationResult = {
  orderId: string | null;
  action: "updated" | "noop" | "ignored";
  reason: string;
  mpStatus?: string | null;
  status?: OrdersRow["status"];
  mpPaymentId?: string | null;
  integrityFailures?: string[];
};

type ReconciliationOrderRow = Pick<
  OrdersRow,
  | "id"
  | "status"
  | "mp_status"
  | "mp_payment_id"
  | "mp_preference_id"
  | "subtotal"
  | "shipping_cost"
  | "total"
>;

export type MercadoPagoWebhookRouteDeps = {
  createAdminClient: typeof createAdminClient;
  getMercadoPagoMerchantOrder: typeof getMercadoPagoMerchantOrder;
  getMercadoPagoPayment: typeof getMercadoPagoPayment;
  getMercadoPagoPreference: typeof getMercadoPagoPreference;
  getMercadoPagoWebhookSecrets: typeof getMercadoPagoWebhookSecrets;
  getMercadoPagoWebhookSecurityMode: typeof getMercadoPagoWebhookSecurityMode;
  isMercadoPagoConfigured: typeof isMercadoPagoConfigured;
  isProductionRuntime: typeof isProductionRuntime;
};

const defaultDeps: MercadoPagoWebhookRouteDeps = {
  createAdminClient,
  getMercadoPagoMerchantOrder,
  getMercadoPagoPayment,
  getMercadoPagoPreference,
  getMercadoPagoWebhookSecrets,
  getMercadoPagoWebhookSecurityMode,
  isMercadoPagoConfigured,
  isProductionRuntime,
};

function normalizeTopic(
  value: string | null | undefined,
): MercadoPagoNotificationTopic {
  return normalizeMercadoPagoNotificationTopic(value);
}

function getNotificationTopic(
  request: NextRequest,
  payload: z.infer<typeof webhookNotificationSchema>,
): MercadoPagoNotificationTopic {
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
function verifyWebhookSignature(
  request: NextRequest,
  payload: z.infer<typeof webhookNotificationSchema>,
  secrets: readonly string[],
) {
  if (secrets.length === 0) {
    return {
      ok: true,
      mode: "skipped",
      reason: "missing_webhook_secret",
      requestId: request.headers.get("x-request-id"),
      matchedSecret: null,
      manifestMatched: false,
    } as const;
  }

  // Step 1: Extract x-signature header
  const xSignatureRaw = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  if (!xSignatureRaw) {
    return {
      ok: false,
      mode: "enforced",
      reason: "missing_signature_header",
      requestId: xRequestId,
      matchedSecret: null,
      manifestMatched: false,
    } as const;
  }

  const signature = parseMercadoPagoSignatureHeader(xSignatureRaw);

  if (!signature) {
    return {
      ok: false,
      mode: "enforced",
      reason: "invalid_signature_header",
      requestId: xRequestId,
      matchedSecret: null,
      manifestMatched: false,
    } as const;
  }

  // Step 2: Build manifest from query params (prefer docs key: data.id).
  // Production notifications can still arrive with legacy id param.
  const dataIdFromQuery = request.nextUrl.searchParams.get("data.id");
  const legacyIdFromQuery = request.nextUrl.searchParams.get("id");
  const dataIdFromPayload =
    payload.data?.id !== undefined && payload.data?.id !== null
      ? String(payload.data.id)
      : payload.id !== undefined && payload.id !== null
        ? String(payload.id)
        : null;

  const manifestCandidates = [
    buildMercadoPagoManifest({
      dataId: dataIdFromQuery,
      requestId: xRequestId,
      ts: signature.ts,
    }),
  ];

  for (const candidateId of [legacyIdFromQuery, dataIdFromPayload]) {
    if (!candidateId || candidateId === dataIdFromQuery) {
      continue;
    }

    manifestCandidates.push(
      buildMercadoPagoManifest({
        dataId: candidateId,
        requestId: xRequestId,
        ts: signature.ts,
      }),
    );
  }

  // Step 3: HMAC-SHA256
  let isValid = false;
  let matchedManifest: string | null = null;
  let matchedSecretIndex: number | null = null;

  for (const manifest of manifestCandidates) {
    for (let secretIndex = 0; secretIndex < secrets.length; secretIndex += 1) {
      const verification = verifyMercadoPagoSignature({
        secret: secrets[secretIndex],
        manifest,
        receivedHash: signature.hash,
      });

      if (verification.ok) {
        isValid = true;
        matchedManifest = manifest;
        matchedSecretIndex = secretIndex;
        break;
      }
    }

    if (isValid) {
      break;
    }
  }

  if (!isValid) {
    console.warn("Mercado Pago webhook signature debug", {
      reason: "signature_mismatch",
      manifestCandidates: manifestCandidates.length,
      hasDataIdFromQuery: Boolean(dataIdFromQuery),
      hasLegacyIdFromQuery: Boolean(legacyIdFromQuery),
      hasDataIdFromPayload: Boolean(dataIdFromPayload),
      hasRequestIdHeader: Boolean(xRequestId),
      secretCandidates: secrets.length,
      path: request.nextUrl.pathname,
    });
  }

  return {
    ok: isValid,
    mode: "enforced",
    reason: isValid ? "verified" : "signature_mismatch",
    requestId: xRequestId,
    matchedSecret: matchedSecretIndex === 0 ? "primary" : matchedSecretIndex === 1 ? "previous" : null,
    manifestMatched: Boolean(matchedManifest),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function areMoneyAmountsEqual(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}

function buildIntegrityBlockedMpStatus(
  payment: MercadoPagoPaymentResponse,
  failures: readonly string[],
) {
  const normalizedPaymentStatus = normalizePaymentStatus(payment.status) ?? "payment_unknown";
  return `integrity_blocked:${normalizedPaymentStatus}:${failures.join("+")}`;
}

function evaluateApprovedPaymentIntegrity(
  order: ReconciliationOrderRow,
  payment: MercadoPagoPaymentResponse,
  mpPreferenceId?: string | null,
) {
  const failures: string[] = [];
  const paymentRecord = payment as unknown as Record<string, unknown>;
  const metadata = isRecord(payment.metadata) ? payment.metadata : null;
  const externalReference = payment.external_reference?.trim() || null;
  const metadataOrderId = readString(metadata?.order_id);
  const transactionAmount = readNumber(paymentRecord.transaction_amount);
  const currencyId = readString(paymentRecord.currency_id)?.toUpperCase() ?? null;
  const metadataTotalUyu = readNumber(metadata?.total_uyu);
  const metadataSubtotalUyu = readNumber(metadata?.subtotal_uyu);
  const metadataShippingCostUyu = readNumber(metadata?.shipping_cost_uyu);

  if (externalReference && externalReference !== order.id) {
    failures.push("external_reference_mismatch");
  }

  if (metadataOrderId && metadataOrderId !== order.id) {
    failures.push("metadata_order_id_mismatch");
  }

  if (externalReference && metadataOrderId && externalReference !== metadataOrderId) {
    failures.push("payment_reference_conflict");
  }

  if (currencyId && currencyId !== "UYU") {
    failures.push("currency_mismatch");
  }

  if (transactionAmount !== null && !areMoneyAmountsEqual(transactionAmount, order.total)) {
    failures.push("amount_mismatch");
  }

  if (metadataTotalUyu !== null && !areMoneyAmountsEqual(metadataTotalUyu, order.total)) {
    failures.push("metadata_total_mismatch");
  }

  if (metadataSubtotalUyu !== null && !areMoneyAmountsEqual(metadataSubtotalUyu, order.subtotal)) {
    failures.push("metadata_subtotal_mismatch");
  }

  if (
    metadataShippingCostUyu !== null &&
    !areMoneyAmountsEqual(metadataShippingCostUyu, order.shipping_cost)
  ) {
    failures.push("metadata_shipping_mismatch");
  }

  if (mpPreferenceId && order.mp_preference_id && mpPreferenceId !== order.mp_preference_id) {
    failures.push("preference_mismatch");
  }

  return {
    ok: failures.length === 0,
    failures,
  };
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
      .select(
        "id, status, mp_status, mp_payment_id, mp_preference_id, subtotal, shipping_cost, total"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (data) {
      return data;
    }
  }

  if (mpPaymentId) {
    const { data } = await admin
      .from("orders")
      .select(
        "id, status, mp_status, mp_payment_id, mp_preference_id, subtotal, shipping_cost, total"
      )
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle();

    if (data) {
      return data;
    }
  }

  if (mpPreferenceId) {
    const { data } = await admin
      .from("orders")
      .select(
        "id, status, mp_status, mp_payment_id, mp_preference_id, subtotal, shipping_cost, total"
      )
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

  if (nextStatus === "paid") {
    const integrityCheck = evaluateApprovedPaymentIntegrity(
      resolvedOrder,
      payment,
      mpPreferenceId,
    );

    if (!integrityCheck.ok) {
      const blockedMpStatus = buildIntegrityBlockedMpStatus(
        payment,
        integrityCheck.failures,
      );
      const blockedResult = await updateOrderIfNeeded(admin, resolvedOrder, {
        mp_status:
          resolvedOrder.mp_status === blockedMpStatus ? undefined : blockedMpStatus,
        mp_payment_id:
          resolvedOrder.mp_payment_id === mpPaymentId ? undefined : mpPaymentId,
        mp_preference_id:
          mpPreferenceId &&
          !integrityCheck.failures.includes("preference_mismatch") &&
          resolvedOrder.mp_preference_id !== mpPreferenceId
            ? mpPreferenceId
            : undefined,
      });

      return {
        ...blockedResult,
        reason:
          blockedResult.action === "updated"
            ? "payment_integrity_blocked"
            : blockedResult.reason,
        integrityFailures: integrityCheck.failures,
      };
    }
  }

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
  getPayment: typeof getMercadoPagoPayment,
): Promise<ReconciliationResult> {
  const mpPreferenceId = merchantOrder.preference_id ?? null;
  const paymentId = selectBestMerchantOrderPayment(merchantOrder);

  if (paymentId) {
    const payment = await getPayment(paymentId);
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

export function createMercadoPagoWebhookRoute(
  deps: MercadoPagoWebhookRouteDeps = defaultDeps,
) {
  return async function POST(request: NextRequest) {
    if (!deps.isMercadoPagoConfigured()) {
      console.error(
        "Mercado Pago webhook received without server credentials configured.",
      );
      return NextResponse.json(
        { error: "Mercado Pago is not configured." },
        { status: 500 },
      );
    }

    const webhookSecurityMode = deps.getMercadoPagoWebhookSecurityMode();

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

    const signatureCheck = verifyWebhookSignature(
      request,
      parsed.data,
      deps.getMercadoPagoWebhookSecrets(),
    );
    const routeDecision = resolveMercadoPagoWebhookRouteDecision({
      topic,
      resourceId,
      hasResourceId: Boolean(resourceId),
      signatureOk: signatureCheck.ok,
      signatureMode: signatureCheck.mode,
      notificationId,
      requestId,
      action: parsed.data.action ?? null,
    });

    if (!signatureCheck.ok) {
      console.warn("Mercado Pago webhook accepted without signature verification", {
        topic,
        resourceId,
        notificationId,
        requestId: signatureCheck.requestId,
        runtime: deps.isProductionRuntime() ? "production" : "development",
        mode: webhookSecurityMode,
        reason: signatureCheck.reason,
        diagnosticCode: signatureCheck.reason,
        hasSignatureHeader: Boolean(request.headers.get("x-signature")),
        sourceOfTruth: "mercadopago_api",
      });
    }

    console.info("Mercado Pago webhook received", {
      topic,
      resourceId,
      notificationId,
      requestId,
      mode: webhookSecurityMode,
      verificationStatus: routeDecision.verificationStatus,
      signatureReason: signatureCheck.reason,
      matchedSecret: signatureCheck.matchedSecret,
      manifestMatched: signatureCheck.manifestMatched,
      sourceOfTruth: "mercadopago_api",
    });

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

    if (!routeDecision.shouldReconcile) {
      return NextResponse.json(
        {
          received: true,
          topic,
          resourceId,
          verificationStatus: routeDecision.verificationStatus,
          ignored: true,
        },
        { status: routeDecision.responseStatus },
      );
    }

    try {
      const admin = deps.createAdminClient();
      let result: ReconciliationResult;

      switch (topic) {
        case "payment": {
          const payment = await deps.getMercadoPagoPayment(resourceId);
          result = await reconcilePayment(admin, payment);
          break;
        }
        case "merchant_order": {
          const merchantOrder = await deps.getMercadoPagoMerchantOrder(resourceId);
          result = await reconcileMerchantOrder(
            admin,
            merchantOrder,
            deps.getMercadoPagoPayment,
          );
          break;
        }
        case "preference": {
          const preference = await deps.getMercadoPagoPreference(resourceId);
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
          integrityFailures: result.integrityFailures,
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
          integrityFailures: result.integrityFailures,
        });
      }

      return NextResponse.json(
        {
          received: true,
          topic,
          resourceId,
          verificationStatus: routeDecision.verificationStatus,
          orderId: result.orderId,
          action: result.action,
          reason: result.reason,
          mpStatus: result.mpStatus ?? null,
          status: result.status ?? null,
          mpPaymentId: result.mpPaymentId ?? null,
        },
        { status: routeDecision.responseStatus },
      );
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
  };
}

export const POST = createMercadoPagoWebhookRoute();
