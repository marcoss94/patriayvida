import crypto from "node:crypto";

export function parseMercadoPagoSignatureHeader(xSignatureRaw: string | null) {
  if (!xSignatureRaw) {
    return null;
  }

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
    return null;
  }

  return { ts, hash };
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
    ok: computed === params.receivedHash,
    computed,
  };
}
