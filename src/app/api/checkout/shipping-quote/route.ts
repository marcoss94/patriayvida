import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isUruguayCity } from "@/lib/checkout-cities";
import { getShippingCost } from "@/lib/checkout";
import { getShippingRule } from "@/lib/shipping-pricing";
import {
  calculateDistanceKm,
  geocodeUruguayAddress,
  getStoreCoordinates,
} from "@/lib/shipping";

const shippingQuoteSchema = z.object({
  deliveryMethod: z.enum(["shipping", "pickup"]),
  address: z.string().trim().max(160).optional().default(""),
  city: z
    .string()
    .trim()
    .max(80)
    .refine((value) => !value || isUruguayCity(value), "Selecciona una ciudad valida de Uruguay.")
    .optional()
    .default(""),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Tenes que iniciar sesion para calcular envio." }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = shippingQuoteSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Solicitud invalida." },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  if (payload.deliveryMethod === "pickup") {
    return NextResponse.json({
      shippingCost: 0,
      distanceKm: null,
      geocodeSource: null,
      shippingRule: "pickup_no_shipping",
    });
  }

  if (!payload.address || !payload.city) {
    const shippingCost = getShippingCost({ deliveryMethod: "shipping", distanceKm: null });

    return NextResponse.json({
      shippingCost,
      distanceKm: null,
      geocodeSource: "missing_input",
      shippingRule: getShippingRule(null, "shipping"),
    });
  }

  const storeCoordinates = getStoreCoordinates();
  const geocodeResult = await geocodeUruguayAddress({
    address: payload.address,
    city: payload.city,
  });
  const distanceKm = geocodeResult.coordinates
    ? calculateDistanceKm(storeCoordinates, geocodeResult.coordinates)
    : null;
  const shippingCost = getShippingCost({ deliveryMethod: "shipping", distanceKm });

  return NextResponse.json({
    shippingCost,
    distanceKm,
    geocodeSource: geocodeResult.source,
    shippingRule: getShippingRule(distanceKm, "shipping"),
  });
}
