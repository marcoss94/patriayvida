import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isUruguayCity } from "@/lib/checkout-cities";
import { getShippingCost } from "@/lib/checkout";
import {
  buildRateLimitHeaders,
  consumeShippingQuoteRateLimit,
} from "@/lib/rate-limit";
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
    .refine((value) => !value || isUruguayCity(value), "Seleccioná una ciudad válida de Uruguay.")
    .optional()
  .default(""),
});

export type ShippingQuoteRouteDeps = {
  calculateDistanceKm: typeof calculateDistanceKm;
  consumeShippingQuoteRateLimit: typeof consumeShippingQuoteRateLimit;
  createClient: typeof createClient;
  geocodeUruguayAddress: typeof geocodeUruguayAddress;
  getShippingCost: typeof getShippingCost;
  getShippingRule: typeof getShippingRule;
  getStoreCoordinates: typeof getStoreCoordinates;
};

const defaultDeps: ShippingQuoteRouteDeps = {
  calculateDistanceKm,
  consumeShippingQuoteRateLimit,
  createClient,
  geocodeUruguayAddress,
  getShippingCost,
  getShippingRule,
  getStoreCoordinates,
};

export function createShippingQuoteRoute(
  deps: ShippingQuoteRouteDeps = defaultDeps,
) {
  return async function POST(request: NextRequest) {
    const supabase = await deps.createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Tenés que iniciar sesión para calcular el envío." },
        { status: 401 },
      );
    }

    const rateLimit = deps.consumeShippingQuoteRateLimit(request, user.id);

    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          error:
            "Demasiadas cotizaciones de envío en poco tiempo. Esperá un momento antes de reintentar.",
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(rateLimit),
        },
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = shippingQuoteSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Solicitud inválida." },
        { status: 400 },
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
      const shippingCost = deps.getShippingCost({
        deliveryMethod: "shipping",
        distanceKm: null,
      });

      return NextResponse.json({
        shippingCost,
        distanceKm: null,
        geocodeSource: "missing_input",
        shippingRule: deps.getShippingRule(null, "shipping"),
      });
    }

    const storeCoordinates = deps.getStoreCoordinates();
    const geocodeResult = await deps.geocodeUruguayAddress({
      address: payload.address,
      city: payload.city,
    });
    const distanceKm = geocodeResult.coordinates
      ? deps.calculateDistanceKm(storeCoordinates, geocodeResult.coordinates)
      : null;
    const shippingCost = deps.getShippingCost({
      deliveryMethod: "shipping",
      distanceKm,
    });

    return NextResponse.json({
      shippingCost,
      distanceKm,
      geocodeSource: geocodeResult.source,
      shippingRule: deps.getShippingRule(distanceKm, "shipping"),
    });
  };
}

export const POST = createShippingQuoteRoute();
