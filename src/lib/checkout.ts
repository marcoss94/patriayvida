import { CART_QUANTITY_CAP } from "@/lib/cart";
import { isUruguayCity } from "@/lib/checkout-cities";
import { getShippingAmount } from "@/lib/shipping-pricing";
import { z } from "zod";

export const deliveryMethodSchema = z.enum(["shipping", "pickup"]);

const checkoutCustomerSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá tu nombre completo."),
  email: z.email("Ingresá un email válido.").trim(),
  phone: z.string().trim().min(6, "Ingresá un teléfono de contacto."),
  address: z.string().trim().max(160).optional().default(""),
  city: z
    .string()
    .trim()
    .max(80)
    .refine((value) => !value || isUruguayCity(value), "Selecciona una ciudad valida de Uruguay.")
    .optional()
    .default(""),
  notes: z.string().trim().max(300).optional().default(""),
});

export const checkoutPayloadSchema = z
  .object({
    deliveryMethod: deliveryMethodSchema,
    customer: checkoutCustomerSchema,
    cart: z.object({
      items: z
        .array(
          z.object({
            variantId: z.string().trim().min(1, "Variante inválida."),
            quantity: z
              .number()
              .int("La cantidad debe ser entera.")
              .min(1, "La cantidad mínima es 1.")
              .max(CART_QUANTITY_CAP, `La cantidad máxima es ${CART_QUANTITY_CAP}.`),
          })
        )
        .min(1, "El carrito no puede estar vacío."),
    }),
  })
  .superRefine((value, context) => {
    if (value.deliveryMethod === "shipping") {
      if (!value.customer.address.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresá la dirección de envío.",
          path: ["customer", "address"],
        });
      }

      if (!value.customer.city.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresá la ciudad para el envío.",
          path: ["customer", "city"],
        });
      }
    }
  });

export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;
export type DeliveryMethod = z.infer<typeof deliveryMethodSchema>;

export type CheckoutStoreConfig = {
  storeName: string;
  shippingFixedCost: number;
  freeShippingThreshold: number | null;
  pickupAddress: string | null;
  pickupInstructions: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

export function normalizeCheckoutPayload(payload: CheckoutPayload): CheckoutPayload {
  return {
    ...payload,
    customer: {
      fullName: payload.customer.fullName.trim(),
      email: payload.customer.email.trim().toLowerCase(),
      phone: payload.customer.phone.trim(),
      address: payload.customer.address.trim(),
      city: payload.customer.city.trim(),
      notes: payload.customer.notes.trim(),
    },
    cart: {
      items: payload.cart.items.map((item) => ({
        variantId: item.variantId.trim(),
        quantity: item.quantity,
      })),
    },
  };
}

export function getShippingCost({
  deliveryMethod,
  distanceKm,
}: {
  deliveryMethod: DeliveryMethod;
  distanceKm: number | null;
}): number {
  return getShippingAmount(distanceKm, deliveryMethod);
}

export function canOfferPickup(storeConfig: Pick<CheckoutStoreConfig, "pickupAddress">): boolean {
  return Boolean(storeConfig.pickupAddress?.trim());
}
