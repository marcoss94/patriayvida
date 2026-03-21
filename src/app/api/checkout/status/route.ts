import { NextRequest, NextResponse } from "next/server";
import { derivePaymentState } from "@/lib/checkout-status";
import { createClient } from "@/lib/supabase/server";

type CheckoutOrderStatusRow = {
  id: string;
  status: string;
  mp_status: string | null;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  total: number;
  updated_at: string;
};

type CheckoutStatusRouteDeps = {
  createClient: typeof createClient;
  derivePaymentState: typeof derivePaymentState;
};

const defaultDeps: CheckoutStatusRouteDeps = {
  createClient,
  derivePaymentState,
};

export function createCheckoutStatusRoute(deps: CheckoutStatusRouteDeps = defaultDeps) {
  return async function GET(request: NextRequest) {
    const checkoutStatus = request.nextUrl.searchParams.get("checkout_status")?.trim() ?? null;
    const pollTimedOut =
      request.nextUrl.searchParams.get("poll_timed_out") === "1" ||
      request.nextUrl.searchParams.get("poll_timed_out") === "true";
    const orderId =
      request.nextUrl.searchParams.get("order_id")?.trim() ||
      request.nextUrl.searchParams.get("external_reference")?.trim() ||
      null;

    if (!orderId) {
      return NextResponse.json(
        { error: "Necesitamos una referencia de orden para consultar el estado." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const requestId = request.headers.get("x-request-id");
    let supabase: Awaited<ReturnType<typeof deps.createClient>>;

    try {
      supabase = await deps.createClient();
    } catch (error) {
      console.error("Checkout status rejected because Supabase runtime config is invalid", {
        requestId,
        orderId,
        error,
      });

      return NextResponse.json(
        {
          error:
            "Configuración incompleta del servidor para consultar órdenes (Supabase). Revisá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Tenés que iniciar sesión para consultar tu orden." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .select("id, status, mp_status, mp_payment_id, mp_preference_id, total, updated_at")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle<CheckoutOrderStatusRow>();

    if (error) {
      console.error("Failed to fetch checkout order status", {
        requestId,
        orderId,
        userId: user.id,
        error,
      });

      return NextResponse.json(
        { error: "No pudimos consultar el estado de la orden." },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "No encontramos esa orden para tu cuenta." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const derived = deps.derivePaymentState(data, {
      checkoutStatus,
      pollTimedOut,
    });

    return NextResponse.json(
      {
        order: {
          id: data.id,
          status: data.status,
          mpStatus: data.mp_status,
          mpPaymentId: data.mp_payment_id,
          mpPreferenceId: data.mp_preference_id,
          total: data.total,
          updatedAt: data.updated_at,
          paymentState: derived.state,
          paymentStateDetail: derived.detail,
          paymentMessage: derived.message,
          shouldPoll: derived.shouldPoll,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  };
}

export const GET = createCheckoutStatusRoute();
