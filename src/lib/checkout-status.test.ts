import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { derivePaymentState } from "@/lib/checkout-status";

describe("derivePaymentState", () => {
  it("marks fully paid lifecycle statuses as paid without polling", () => {
    for (const status of ["paid", "preparing", "shipped", "delivered"]) {
      const derived = derivePaymentState({ status, mp_status: "pending" });
      assert.equal(derived.state, "paid");
      assert.equal(derived.detail, "order_paid");
      assert.equal(derived.shouldPoll, false);
    }
  });

  it("maps cancelled orders to failure", () => {
    const derived = derivePaymentState({ status: "cancelled", mp_status: "approved" });
    assert.equal(derived.state, "failure");
    assert.equal(derived.detail, "order_cancelled");
    assert.equal(derived.shouldPoll, false);
  });

  it("interprets approved and rejected payment states from Mercado Pago status", () => {
    assert.equal(derivePaymentState({ status: "pending", mp_status: "approved:accredited" }).detail, "payment_approved");
    assert.equal(derivePaymentState({ status: "pending", mp_status: "rejected:cc_rejected" }).detail, "payment_rejected");
    assert.equal(derivePaymentState({ status: "pending", mp_status: "abandoned" }).detail, "payment_rejected");
  });

  it("keeps polling while payment remains pending or unknown", () => {
    assert.equal(derivePaymentState({ status: "pending", mp_status: "in_process:pending_review_manual" }).detail, "payment_pending");
    assert.equal(derivePaymentState({ status: "pending", mp_status: null }).detail, "payment_unknown");
    assert.equal(derivePaymentState({ status: "pending", mp_status: null }).shouldPoll, true);
  });

  it("marks callback failures without payment as abandoned", () => {
    const derived = derivePaymentState(
      { status: "pending", mp_status: "preference_created" },
      { checkoutStatus: "failure" }
    );

    assert.equal(derived.state, "failure");
    assert.equal(derived.detail, "payment_abandoned");
    assert.equal(derived.shouldPoll, false);
  });

  it("stops polling with terminal timeout state", () => {
    const derived = derivePaymentState(
      { status: "pending", mp_status: "in_process" },
      { pollTimedOut: true }
    );

    assert.equal(derived.state, "failure");
    assert.equal(derived.detail, "payment_timeout");
    assert.equal(derived.shouldPoll, false);
  });
});
