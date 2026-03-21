import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMercadoPagoManifest,
  createMercadoPagoSignature,
  parseMercadoPagoSignatureHeader,
  verifyMercadoPagoSignature,
  verifyMercadoPagoSignatureWithRotation,
} from "@/lib/mercadopago-webhook";

describe("mercadopago webhook signature helpers", () => {
  it("parses ts and v1 from x-signature header", () => {
    assert.deepEqual(parseMercadoPagoSignatureHeader("ts=1700000000,v1=abc123"), {
      ts: "1700000000",
      hash: "abc123",
    });
    assert.deepEqual(
      parseMercadoPagoSignatureHeader(" TS = 1700000000 , V1 = ABC123 "),
      {
        ts: "1700000000",
        hash: "abc123",
      },
    );
    assert.deepEqual(parseMercadoPagoSignatureHeader("ts=1700000000,broken-part,v1=abc123"), {
      ts: "1700000000",
      hash: "abc123",
    });
    assert.equal(parseMercadoPagoSignatureHeader("ts=only"), null);
    assert.equal(parseMercadoPagoSignatureHeader(null), null);
  });

  it("builds manifest removing missing optional values", () => {
    assert.equal(
      buildMercadoPagoManifest({ dataId: "999", requestId: "req-1", ts: "1700000000" }),
      "id:999;request-id:req-1;ts:1700000000;",
    );
    assert.equal(buildMercadoPagoManifest({ dataId: null, requestId: null, ts: "1700000000" }), "ts:1700000000;");
  });

  it("verifies expected hash from deterministic manifest", () => {
    const secret = "test-secret";
    const manifest = buildMercadoPagoManifest({ dataId: "1", requestId: "req-2", ts: "1700000000" });
    const receivedHash = createMercadoPagoSignature(secret, manifest);

    const verification = verifyMercadoPagoSignature({ secret, manifest, receivedHash });
    assert.equal(verification.ok, true);
    assert.equal(verification.computed, receivedHash);

    const invalid = verifyMercadoPagoSignature({ secret, manifest, receivedHash: "invalid" });
    assert.equal(invalid.ok, false);
  });

  it("accepts hash comparisons with spaces and uppercase", () => {
    const secret = "test-secret";
    const manifest = buildMercadoPagoManifest({ dataId: "11", requestId: "req-7", ts: "1700000001" });
    const hash = createMercadoPagoSignature(secret, manifest);

    const verification = verifyMercadoPagoSignature({
      secret,
      manifest,
      receivedHash: `  ${hash.toUpperCase()}  `,
    });

    assert.equal(verification.ok, true);
  });

  it("supports secret rotation with previous secret fallback", () => {
    const manifest = buildMercadoPagoManifest({ dataId: "1", requestId: "req-8", ts: "1700000002" });
    const oldSecret = "old-secret";
    const newSecret = "new-secret";
    const receivedHash = createMercadoPagoSignature(oldSecret, manifest);

    const verification = verifyMercadoPagoSignatureWithRotation({
      secrets: [newSecret, oldSecret],
      manifest,
      receivedHash,
    });

    assert.equal(verification.ok, true);
    assert.equal(verification.matchedSecretIndex, 1);
  });
});
