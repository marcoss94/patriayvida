import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionOrderStatus,
  getAllowedStatusTransitions,
  getPaymentStatusMeta,
} from "@/lib/orders";

describe("orders transition guards", () => {
  it("allows forward transitions and blocks invalid jumps", () => {
    assert.equal(canTransitionOrderStatus("pending", "paid"), true);
    assert.equal(canTransitionOrderStatus("paid", "preparing"), true);
    assert.equal(canTransitionOrderStatus("pending", "delivered"), false);
    assert.equal(canTransitionOrderStatus("cancelled", "paid"), false);
  });

  it("allows idempotent transitions and rejects unknown statuses", () => {
    assert.equal(canTransitionOrderStatus("pending", "pending"), true);
    assert.equal(canTransitionOrderStatus("pending", "mystery"), false);
    assert.deepEqual(getAllowedStatusTransitions("mystery"), []);
  });

  it("returns deterministic allowed transitions for business statuses", () => {
    assert.deepEqual(getAllowedStatusTransitions("pending"), ["paid", "preparing", "cancelled"]);
    assert.deepEqual(getAllowedStatusTransitions("shipped"), ["delivered"]);
    assert.deepEqual(getAllowedStatusTransitions("delivered"), []);
  });
});

describe("orders payment status mapping", () => {
  it("prioritizes order status when already paid", () => {
    assert.deepEqual(getPaymentStatusMeta({ status: "paid", mp_status: "rejected:cc_rejected" }), {
      label: "Pago acreditado",
      tone: "success",
    });
  });

  it("maps merchant statuses from mp_status base", () => {
    assert.deepEqual(getPaymentStatusMeta({ status: "pending", mp_status: "in_process:pending_contingency" }), {
      label: "Pago pendiente",
      tone: "pending",
    });

    assert.deepEqual(getPaymentStatusMeta({ status: "pending", mp_status: "charged_back:recovered" }), {
      label: "Pago rechazado",
      tone: "danger",
    });
  });
});
