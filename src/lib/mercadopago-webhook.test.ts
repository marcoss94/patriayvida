import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMercadoPagoManifest,
  createMercadoPagoSignature,
  isMercadoPagoResourceId,
  normalizeMercadoPagoNotificationTopic,
  parseMercadoPagoSignatureHeader,
  resolveMercadoPagoWebhookRouteDecision,
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

  it("normalizes supported topics and buckets unknown ones", () => {
    assert.equal(normalizeMercadoPagoNotificationTopic("payment"), "payment");
    assert.equal(normalizeMercadoPagoNotificationTopic("merchant_order"), "merchant_order");
    assert.equal(normalizeMercadoPagoNotificationTopic("preference"), "preference");
    assert.equal(normalizeMercadoPagoNotificationTopic("plan"), "unknown");
    assert.equal(normalizeMercadoPagoNotificationTopic(null), "unknown");
  });

  it("accepts only numeric Mercado Pago resource id shapes", () => {
    assert.equal(isMercadoPagoResourceId("123456"), true);
    assert.equal(isMercadoPagoResourceId(" 1234567890 "), true);
    assert.equal(isMercadoPagoResourceId("abc123"), false);
    assert.equal(isMercadoPagoResourceId("12345"), false);
    assert.equal(isMercadoPagoResourceId(null), false);
  });

  it("keeps reconciling when signature mismatches but ids exist", () => {
    assert.deepEqual(
      resolveMercadoPagoWebhookRouteDecision({
        topic: "payment",
        resourceId: "123456",
        hasResourceId: true,
        signatureOk: false,
        signatureMode: "enforced",
        requestId: "req-1",
      }),
      {
        shouldReconcile: true,
        verificationStatus: "unverified",
        responseStatus: 200,
      },
    );
  });

  it("returns 202 when intake cannot reconcile due to missing resource id", () => {
    assert.deepEqual(
      resolveMercadoPagoWebhookRouteDecision({
        topic: "payment",
        resourceId: null,
        hasResourceId: false,
        signatureOk: true,
        signatureMode: "enforced",
      }),
      {
        shouldReconcile: false,
        verificationStatus: "verified",
        responseStatus: 202,
      },
    );
  });

  it("marks missing-secret mode as skipped while still allowing reconciliation", () => {
    assert.deepEqual(
      resolveMercadoPagoWebhookRouteDecision({
        topic: "payment",
        resourceId: "123456",
        hasResourceId: true,
        signatureOk: true,
        signatureMode: "skipped",
      }),
      {
        shouldReconcile: true,
        verificationStatus: "skipped",
        responseStatus: 200,
      },
    );
  });

  it("returns 202 for unverified requests with weak evidence", () => {
    assert.deepEqual(
      resolveMercadoPagoWebhookRouteDecision({
        topic: "payment",
        resourceId: "123456",
        hasResourceId: true,
        signatureOk: false,
        signatureMode: "enforced",
      }),
      {
        shouldReconcile: false,
        verificationStatus: "unverified",
        responseStatus: 202,
      },
    );
  });

  it("returns 202 for unverified requests with non Mercado Pago resource ids", () => {
    assert.deepEqual(
      resolveMercadoPagoWebhookRouteDecision({
        topic: "payment",
        resourceId: "pay_123",
        hasResourceId: true,
        signatureOk: false,
        signatureMode: "enforced",
        requestId: "req-2",
      }),
      {
        shouldReconcile: false,
        verificationStatus: "unverified",
        responseStatus: 202,
      },
    );
  });

  it("returns 202 for unverified preference notifications", () => {
    assert.deepEqual(
      resolveMercadoPagoWebhookRouteDecision({
        topic: "preference",
        resourceId: "123456",
        hasResourceId: true,
        signatureOk: false,
        signatureMode: "enforced",
        requestId: "req-3",
      }),
      {
        shouldReconcile: false,
        verificationStatus: "unverified",
        responseStatus: 202,
      },
    );
  });

  it("accepts unverified merchant order notifications when topic and action correlate", () => {
    assert.deepEqual(
      resolveMercadoPagoWebhookRouteDecision({
        topic: "merchant_order",
        resourceId: "123456",
        hasResourceId: true,
        signatureOk: false,
        signatureMode: "enforced",
        action: "merchant_order.updated",
      }),
      {
        shouldReconcile: true,
        verificationStatus: "unverified",
        responseStatus: 200,
      },
    );
  });
});
