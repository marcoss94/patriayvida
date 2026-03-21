import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMercadoPagoPreferenceItems } from "@/lib/checkout";

describe("buildMercadoPagoPreferenceItems", () => {
  it("adds shipping as a separate Mercado Pago line item when needed", () => {
    const items = buildMercadoPagoPreferenceItems(
      [
        {
          variantId: "variant-1",
          productName: "Remera Patria y Vida",
          variantName: "Negra",
          size: "L",
          quantity: 2,
          unitPrice: 150,
        },
      ],
      180
    );

    assert.deepEqual(items, [
      {
        id: "variant-1",
        title: "Remera Patria y Vida - L",
        description: "Remera Patria y Vida / Negra",
        quantity: 2,
        unit_price: 150,
        currency_id: "UYU",
      },
      {
        id: "shipping",
        title: "Costo de envío",
        description: "Entrega a domicilio",
        quantity: 1,
        unit_price: 180,
        currency_id: "UYU",
      },
    ]);
  });

  it("skips the shipping line item for pickup or free shipping", () => {
    const items = buildMercadoPagoPreferenceItems(
      [
        {
          variantId: "variant-2",
          productName: "Buzo",
          variantName: "Azul",
          size: null,
          quantity: 1,
          unitPrice: 300,
        },
      ],
      0
    );

    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "variant-2");
  });
});
