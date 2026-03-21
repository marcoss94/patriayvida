import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildMercadoPagoPreferenceItems,
  getShippingCost,
  type CheckoutOrderLine,
} from "@/lib/checkout";
import { derivePaymentState } from "@/lib/checkout-status";
import {
  getShippingRule,
  SHIPPING_BASE_UYU,
  SHIPPING_LONG_DISTANCE_UYU,
} from "@/lib/shipping-pricing";

const ORDER_LINES: CheckoutOrderLine[] = [
  {
    variantId: "variant-1",
    productName: "Remera Patria y Vida",
    variantName: "Negra",
    size: "L",
    quantity: 2,
    unitPrice: 150,
  },
];

function getPreferenceTotal(shippingCost: number) {
  return buildMercadoPagoPreferenceItems(ORDER_LINES, shippingCost).reduce(
    (total, item) => total + item.quantity * item.unit_price,
    0
  );
}

describe("checkout totals and shipping flow", () => {
  it("keeps pickup totals clean and skips the shipping line item", () => {
    const shippingCost = getShippingCost({ deliveryMethod: "pickup", distanceKm: 12 });
    const items = buildMercadoPagoPreferenceItems(ORDER_LINES, shippingCost);

    assert.equal(shippingCost, 0);
    assert.equal(getShippingRule(12, "pickup"), "pickup_no_shipping");
    assert.equal(items.length, 1);
    assert.equal(getPreferenceTotal(shippingCost), 300);
  });

  it("uses the base shipping total when distance is still unknown", () => {
    const shippingCost = getShippingCost({ deliveryMethod: "shipping", distanceKm: null });
    const items = buildMercadoPagoPreferenceItems(ORDER_LINES, shippingCost);

    assert.equal(shippingCost, SHIPPING_BASE_UYU);
    assert.equal(getShippingRule(null, "shipping"), "distance_lte_5km_or_unknown");
    assert.equal(items.at(-1)?.id, "shipping");
    assert.equal(items.at(-1)?.unit_price, SHIPPING_BASE_UYU);
    assert.equal(getPreferenceTotal(shippingCost), 300 + SHIPPING_BASE_UYU);
  });

  it("switches to the long-distance shipping total when the quote crosses the threshold", () => {
    const shippingCost = getShippingCost({ deliveryMethod: "shipping", distanceKm: 12 });
    const items = buildMercadoPagoPreferenceItems(ORDER_LINES, shippingCost);

    assert.equal(shippingCost, SHIPPING_LONG_DISTANCE_UYU);
    assert.equal(getShippingRule(12, "shipping"), "distance_gt_5km");
    assert.equal(items.at(-1)?.id, "shipping");
    assert.equal(items.at(-1)?.unit_price, SHIPPING_LONG_DISTANCE_UYU);
    assert.equal(getPreferenceTotal(shippingCost), 300 + SHIPPING_LONG_DISTANCE_UYU);
  });
});

describe("checkout return transitions", () => {
  it("trusts Mercado Pago approval over a noisy return status", () => {
    const derived = derivePaymentState(
      { status: "pending", mp_status: "approved:accredited" },
      { checkoutStatus: "failure" }
    );

    assert.equal(derived.state, "paid");
    assert.equal(derived.detail, "payment_approved");
    assert.equal(derived.shouldPoll, true);
  });

  it("marks unfinished returns as abandoned when the shopper comes back without a confirmed payment", () => {
    const derived = derivePaymentState(
      { status: "pending", mp_status: "preference_pending" },
      { checkoutStatus: "failure" }
    );

    assert.equal(derived.state, "failure");
    assert.equal(derived.detail, "payment_abandoned");
    assert.equal(derived.shouldPoll, false);
  });

  it("stops retry messaging once a pending payment times out on return polling", () => {
    const derived = derivePaymentState(
      { status: "pending", mp_status: "pending:waiting_payment" },
      { checkoutStatus: "pending", pollTimedOut: true }
    );

    assert.equal(derived.state, "failure");
    assert.equal(derived.detail, "payment_timeout");
    assert.equal(derived.shouldPoll, false);
  });
});
