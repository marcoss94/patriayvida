import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMercadoPagoManifest,
  createMercadoPagoSignature,
  parseMercadoPagoSignatureHeader,
  verifyMercadoPagoSignature,
} from "@/lib/mercadopago-webhook";

describe("mercadopago webhook signature helpers", () => {
  it("parses ts and v1 from x-signature header", () => {
    assert.deepEqual(parseMercadoPagoSignatureHeader("ts=1700000000,v1=abc123"), {
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
});
