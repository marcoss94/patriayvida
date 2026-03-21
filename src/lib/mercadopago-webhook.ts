import crypto from "node:crypto";

export type MercadoPagoNotificationTopic =
  | "payment"
  | "merchant_order"
  | "preference"
  | "unknown";

export type MercadoPagoWebhookRouteDecision = {
  shouldReconcile: boolean;
  verificationStatus: "verified" | "unverified" | "skipped";
  responseStatus: 200 | 202;
};

function normalizeSignatureHash(value: string) {
  return value.trim().toLowerCase();
}

function safeCompareHashes(left: string, right: string) {
  const leftNormalized = normalizeSignatureHash(left);
  const rightNormalized = normalizeSignatureHash(right);

  if (!leftNormalized || !rightNormalized) {
    return false;
  }

  if (leftNormalized.length !== rightNormalized.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(leftNormalized, "utf8"),
    Buffer.from(rightNormalized, "utf8"),
  );
}

export function parseMercadoPagoSignatureHeader(xSignatureRaw: string | null) {
  if (!xSignatureRaw) {
    return null;
  }

  const parts = xSignatureRaw.split(",");
  let ts: string | undefined;
  let hash: string | undefined;

  for (const part of parts) {
    const segment = part.trim();
    const separatorIndex = segment.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim().toLowerCase();
    const value = segment.slice(separatorIndex + 1).trim();

    if (key && value) {
      if (key === "ts") ts = value;
      else if (key === "v1") hash = normalizeSignatureHash(value);
    }
  }

  if (!ts || !hash) {
    return null;
  }

  return { ts, hash };
}

export function normalizeMercadoPagoNotificationTopic(
  value: string | null | undefined,
): MercadoPagoNotificationTopic {
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

export function resolveMercadoPagoWebhookRouteDecision(params: {
  hasResourceId: boolean;
  signatureOk: boolean;
  signatureMode: "enforced" | "skipped";
}) {
  if (!params.hasResourceId) {
    return {
      shouldReconcile: false,
      verificationStatus: params.signatureMode === "skipped" ? "skipped" : params.signatureOk ? "verified" : "unverified",
      responseStatus: 202,
    } satisfies MercadoPagoWebhookRouteDecision;
  }

  if (params.signatureMode === "skipped") {
    return {
      shouldReconcile: true,
      verificationStatus: "skipped",
      responseStatus: 200,
    } satisfies MercadoPagoWebhookRouteDecision;
  }

  if (params.signatureOk) {
    return {
      shouldReconcile: true,
      verificationStatus: "verified",
      responseStatus: 200,
    } satisfies MercadoPagoWebhookRouteDecision;
  }

  return {
    shouldReconcile: true,
    verificationStatus: "unverified",
    responseStatus: 200,
  } satisfies MercadoPagoWebhookRouteDecision;
}

export function buildMercadoPagoManifest(params: {
  dataId: string | null;
  requestId: string | null;
  ts: string;
}) {
  const { dataId, requestId, ts } = params;

  let manifest = "";

  if (dataId) manifest += `id:${dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  return manifest;
}

export function createMercadoPagoSignature(secret: string, manifest: string) {
  return crypto.createHmac("sha256", secret).update(manifest).digest("hex");
}

export function verifyMercadoPagoSignature(params: {
  secret: string;
  manifest: string;
  receivedHash: string;
}) {
  const computed = createMercadoPagoSignature(params.secret, params.manifest);
  return {
    ok: safeCompareHashes(computed, params.receivedHash),
    computed,
  };
}

export function verifyMercadoPagoSignatureWithRotation(params: {
  secrets: readonly string[];
  manifest: string;
  receivedHash: string;
}) {
  let computed: string | null = null;

  for (let index = 0; index < params.secrets.length; index += 1) {
    const verification = verifyMercadoPagoSignature({
      secret: params.secrets[index],
      manifest: params.manifest,
      receivedHash: params.receivedHash,
    });

    computed = verification.computed;

    if (verification.ok) {
      return {
        ok: true,
        matchedSecretIndex: index,
        computed,
      } as const;
    }
  }

  return {
    ok: false,
    matchedSecretIndex: null,
    computed,
  } as const;
}
