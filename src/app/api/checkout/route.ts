import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@/types/database";
import {
  buildMercadoPagoPreferenceItems,
  checkoutPayloadSchema,
  getShippingCost,
  normalizeCheckoutPayload,
} from "@/lib/checkout";
import {
  calculateDistanceKm,
  geocodeUruguayAddress,
  getStoreCoordinates,
} from "@/lib/shipping";
import { getShippingRule } from "@/lib/shipping-pricing";
import {
  createCheckoutProPreference,
  getCheckoutRedirectUrl,
  isMercadoPagoConfigured,
} from "@/lib/mercadopago";
import { createClient } from "@/lib/supabase/server";
import { isProductionRuntime } from "@/lib/env";

type VariantRow = {
  id: string;
  name: string;
  stock: number;
  price_override: number | string | null;
  is_active: boolean;
  attributes: { size?: string } | null;
  product: {
    id: string;
    name: string;
    slug: string;
    base_price: number | string;
    is_active: boolean;
  };
};

type MercadoPagoErrorDetails = {
  status?: number;
  message?: string;
  cause?: unknown;
};

type CheckoutBaseUrlResult =
  | {
      ok: true;
      baseUrl: string;
      source: "env" | "request";
      envVar?: string;
    }
  | {
      ok: false;
      error: string;
      debug?: {
        envVar?: string;
        envValue?: string;
        origin?: string;
      };
    };

const APP_URL_ENV_KEYS = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

function normalizeBaseUrl(rawValue: string): string | null {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return null;
  }

  const value = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.pathname = "";
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isLocalOrPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1"
  ) {
    return true;
  }

  if (normalized.endsWith(".local")) {
    return true;
  }

  return (
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function getRequestOrigin(request: NextRequest): string | null {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");

  if (forwardedProto && forwardedHost) {
    const normalized = normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`);

    if (normalized) {
      return normalized;
    }
  }

  if (host) {
    const normalized = normalizeBaseUrl(`${request.nextUrl.protocol}//${host}`);

    if (normalized) {
      return normalized;
    }
  }

  return normalizeBaseUrl(request.nextUrl.origin);
}

function resolveCheckoutBaseUrl(request: NextRequest): CheckoutBaseUrlResult {
  for (const envKey of APP_URL_ENV_KEYS) {
    const envValue = process.env[envKey];

    if (!envValue) {
      continue;
    }

    const normalized = normalizeBaseUrl(envValue);

    if (!normalized) {
      return {
        ok: false,
        error: `La variable ${envKey} no tiene una URL valida.`,
        debug: {
          envVar: envKey,
          envValue,
        },
      };
    }

    return {
      ok: true,
      baseUrl: normalized,
      source: "env",
      envVar: envKey,
    };
  }

  const origin = getRequestOrigin(request);

  if (!origin) {
    return {
      ok: false,
      error:
        "No pudimos resolver la URL base de la app para construir los back_urls de Mercado Pago.",
    };
  }

  return {
    ok: true,
    baseUrl: origin,
    source: "request",
  };
}

function buildMercadoPagoUrl(baseUrl: string, pathname: string, searchParams?: Record<string, string>) {
  const url = new URL(pathname, `${baseUrl}/`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function getMercadoPagoErrorDetails(error: unknown): MercadoPagoErrorDetails {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as {
    status?: unknown;
    message?: unknown;
    cause?: unknown;
  };

  return {
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    message: typeof candidate.message === "string" ? candidate.message : undefined,
    cause: candidate.cause,
  };
}

export async function POST(request: NextRequest) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en el servidor." },
      { status: 500 }
    );
  }

  if (
    isProductionRuntime() &&
    !APP_URL_ENV_KEYS.some((envKey) => process.env[envKey]?.trim())
  ) {
    return NextResponse.json(
      {
        error:
          "Configuración incompleta: en producción definí APP_URL (o NEXT_PUBLIC_APP_URL) para construir URLs de retorno y webhooks de Mercado Pago.",
      },
      { status: 500 }
    );
  }

  const requestId = request.headers.get("x-request-id");
  let supabase: Awaited<ReturnType<typeof createClient>>;

  try {
    supabase = await createClient();
  } catch (error) {
    console.error("Checkout rejected because Supabase runtime config is invalid", {
      requestId,
      error,
    });

    return NextResponse.json(
      {
        error:
          "Configuración incompleta del servidor para checkout (Supabase). Revisá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Tenés que iniciar sesión para comprar." }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = checkoutPayloadSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Los datos del checkout no son válidos.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const payload = normalizeCheckoutPayload(parsed.data);
  console.info("Checkout payload accepted", {
    requestId,
    userId: user.id,
    deliveryMethod: payload.deliveryMethod,
    lineItems: payload.cart.items.length,
  });

  const baseUrlResult = resolveCheckoutBaseUrl(request);

  if (!baseUrlResult.ok) {
    return NextResponse.json(
      {
        error: baseUrlResult.error,
        ...(process.env.NODE_ENV !== "production"
          ? {
              debug: baseUrlResult.debug,
            }
          : {}),
      },
      { status: 500 }
    );
  }

  if (isLocalOrPrivateHostname(new URL(baseUrlResult.baseUrl).hostname)) {
    return NextResponse.json(
      {
        error:
          "Mercado Pago necesita una URL publica para back_urls y webhooks. Defini NEXT_PUBLIC_APP_URL o APP_URL con una URL accesible desde internet.",
        ...(process.env.NODE_ENV !== "production"
          ? {
              debug: {
                baseUrl: baseUrlResult.baseUrl,
                source: baseUrlResult.source,
                envVar: baseUrlResult.envVar,
              },
            }
          : {}),
      },
      { status: 500 }
    );
  }

  const requestedLines = Array.from(
    payload.cart.items.reduce((accumulator, item) => {
      accumulator.set(item.variantId, (accumulator.get(item.variantId) ?? 0) + item.quantity);
      return accumulator;
    }, new Map<string, number>())
  );
  const variantIds = requestedLines.map(([variantId]) => variantId);

  const [{ data: storeConfigRow }, { data: variants, error: variantsError }] = await Promise.all([
    supabase
      .from("store_config")
      .select("store_name")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("product_variants")
      .select(
        `
          id,
          name,
          stock,
          price_override,
          is_active,
          attributes,
          product:products!inner(
            id,
            name,
            slug,
            base_price,
            is_active
          )
        `
      )
      .in("id", variantIds)
      .eq("is_active", true)
      .eq("product.is_active", true),
  ]);

  if (variantsError) {
    return NextResponse.json(
      { error: "No pudimos validar el carrito contra la base de datos." },
      { status: 500 }
    );
  }

  const variantsById = new Map<string, VariantRow>(
    ((variants ?? []) as unknown as VariantRow[]).map((variant) => [variant.id, variant])
  );
  const validationIssues: string[] = [];

  const orderLines = requestedLines
    .map(([variantId, quantity]) => {
      const variant = variantsById.get(variantId);

      if (!variant) {
        validationIssues.push("Una de las variantes ya no está disponible.");
        return null;
      }

      if (variant.stock < quantity) {
        validationIssues.push(
          `${variant.product.name} (${variant.name}) ya no tiene stock suficiente.`
        );
        return null;
      }

      const unitPrice = Number(variant.price_override ?? variant.product.base_price);

      return {
        variantId: variant.id,
        quantity,
        unitPrice,
        productName: variant.product.name,
        variantName: variant.name,
        size:
          variant.attributes && typeof variant.attributes.size === "string"
            ? variant.attributes.size
            : null,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (validationIssues.length > 0 || orderLines.length === 0) {
    console.warn("Checkout rejected after stock reconciliation", {
      requestId,
      userId: user.id,
      issues: validationIssues,
      requestedVariantCount: requestedLines.length,
      resolvedVariantCount: orderLines.length,
    });

    return NextResponse.json(
      {
        error:
          validationIssues[0] ??
          "El carrito cambió y ya no coincide con el stock disponible. Revisalo antes de pagar.",
      },
      { status: 409 }
    );
  }

  const subtotal = orderLines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
  const storeCoordinates = getStoreCoordinates();
  const geocodeResult =
    payload.deliveryMethod === "shipping"
      ? await geocodeUruguayAddress({
          address: payload.customer.address,
          city: payload.customer.city,
        })
      : { coordinates: null, source: "failed" as const };
  const geocodeSource = payload.deliveryMethod === "shipping" ? geocodeResult.source : null;
  const distanceKm =
    payload.deliveryMethod === "shipping" && geocodeResult.coordinates
      ? calculateDistanceKm(storeCoordinates, geocodeResult.coordinates)
      : null;
  const shippingCost = getShippingCost({
    deliveryMethod: payload.deliveryMethod,
    distanceKm,
  });
  const total = subtotal + shippingCost;
  const shippingRule = getShippingRule(distanceKm, payload.deliveryMethod);

  if (payload.deliveryMethod === "shipping" && geocodeSource !== "nominatim") {
    console.warn("Checkout shipping geocoding fallback used", {
      requestId,
      userId: user.id,
      orderAddress: payload.customer.address,
      orderCity: payload.customer.city,
      geocodeSource,
    });
  }

  const shippingAddress: Json = {
    full_name: payload.customer.fullName,
    email: payload.customer.email,
    phone: payload.customer.phone,
    address: payload.customer.address || null,
    city: payload.customer.city || null,
    notes: payload.customer.notes || null,
    coordinates: geocodeResult.coordinates
      ? {
          lat: geocodeResult.coordinates.latitude,
          lng: geocodeResult.coordinates.longitude,
        }
      : null,
    store_coordinates: {
      lat: storeCoordinates.latitude,
      lng: storeCoordinates.longitude,
    },
    distance_km: distanceKm,
    geocode_source: geocodeSource,
    shipping_rule: shippingRule,
    shipping_price_uyu: shippingCost,
  };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      status: "pending",
      delivery_method: payload.deliveryMethod,
      shipping_cost: shippingCost,
      subtotal,
      total,
      shipping_address: shippingAddress,
      mp_status: "preference_pending",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Checkout failed while creating order", {
      requestId,
      userId: user.id,
      error: orderError,
    });

    return NextResponse.json({ error: "No pudimos crear la orden." }, { status: 500 });
  }

  console.info("Checkout order created", {
    requestId,
    orderId: order.id,
    userId: user.id,
    deliveryMethod: payload.deliveryMethod,
    subtotal,
    shippingCost,
    distanceKm,
    geocodeSource,
    total,
    lineItems: orderLines.length,
  });

  const { error: orderItemsError } = await supabase.from("order_items").insert(
    orderLines.map((line) => ({
      order_id: order.id,
      variant_id: line.variantId,
      quantity: line.quantity,
      unit_price: line.unitPrice,
    }))
  );

  if (orderItemsError) {
    console.error("Checkout failed while creating order items", {
      requestId,
      orderId: order.id,
      userId: user.id,
      error: orderItemsError,
    });

    await supabase
      .from("orders")
      .update({ mp_status: "order_items_error" })
      .eq("id", order.id)
      .eq("user_id", user.id);

    return NextResponse.json(
      { error: "La orden se creó, pero falló la carga de sus items." },
      { status: 500 }
    );
  }

  try {
    const preference = await createCheckoutProPreference({
      external_reference: order.id,
      statement_descriptor: "PATRIA Y VIDA",
      notification_url: buildMercadoPagoUrl(baseUrlResult.baseUrl, "/api/webhooks/mercadopago"),
      back_urls: {
        success: buildMercadoPagoUrl(baseUrlResult.baseUrl, "/checkout", {
          checkout_status: "success",
          order_id: order.id,
        }),
        pending: buildMercadoPagoUrl(baseUrlResult.baseUrl, "/checkout", {
          checkout_status: "pending",
          order_id: order.id,
        }),
        failure: buildMercadoPagoUrl(baseUrlResult.baseUrl, "/checkout", {
          checkout_status: "failure",
          order_id: order.id,
        }),
      },
      auto_return: "approved",
      payer: {
        email: payload.customer.email,
        name: payload.customer.fullName,
        phone: {
          number: payload.customer.phone,
        },
      },
      metadata: {
        order_id: order.id,
        user_id: user.id,
        delivery_method: payload.deliveryMethod,
        subtotal_uyu: subtotal,
        shipping_cost_uyu: shippingCost,
        total_uyu: total,
      },
      items: buildMercadoPagoPreferenceItems(orderLines, shippingCost),
    });

    const redirectUrl = getCheckoutRedirectUrl(preference);

    if (!preference.id || !redirectUrl) {
      await supabase
        .from("orders")
        .update({ mp_status: "preference_missing_redirect" })
        .eq("id", order.id)
        .eq("user_id", user.id);

      return NextResponse.json(
        { error: "Mercado Pago no devolvió una URL válida para continuar el pago." },
        { status: 502 }
      );
    }

    await supabase
      .from("orders")
      .update({
        mp_preference_id: preference.id,
        mp_status: "preference_created",
      })
      .eq("id", order.id)
      .eq("user_id", user.id);

    console.info("Checkout Mercado Pago preference created", {
      requestId,
      orderId: order.id,
      preferenceId: preference.id,
      baseUrlSource: baseUrlResult.source,
      baseUrlEnvVar: baseUrlResult.envVar,
    });

    return NextResponse.json({
      orderId: order.id,
      preferenceId: preference.id,
      initPoint: redirectUrl,
      total,
      storeName: storeConfigRow?.store_name ?? "Patria y Vida",
    });
  } catch (error) {
    const mpError = getMercadoPagoErrorDetails(error);

    console.error("Mercado Pago preference creation failed", {
      requestId,
      orderId: order.id,
      baseUrl: baseUrlResult.baseUrl,
      baseUrlSource: baseUrlResult.source,
      baseUrlEnvVar: baseUrlResult.envVar,
      status: mpError.status,
      message: mpError.message,
      cause: mpError.cause,
      error,
    });

    await supabase
      .from("orders")
      .update({ mp_status: "preference_error" })
      .eq("id", order.id)
      .eq("user_id", user.id);

    return NextResponse.json(
      {
        error: "No pudimos iniciar el pago con Mercado Pago.",
        ...(process.env.NODE_ENV !== "production"
          ? {
              debug:
                mpError.status || mpError.message || mpError.cause
                  ? {
                      baseUrl: baseUrlResult.baseUrl,
                      source: baseUrlResult.source,
                      envVar: baseUrlResult.envVar,
                      status: mpError.status,
                      message: mpError.message,
                      cause: mpError.cause,
                    }
                  : undefined,
            }
          : {}),
      },
      { status: 502 }
    );
  }
}
