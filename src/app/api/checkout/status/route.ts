import { NextRequest, NextResponse } from "next/server";
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

function derivePaymentState(order: Pick<CheckoutOrderStatusRow, "status" | "mp_status">) {
  if (["paid", "preparing", "shipped", "delivered"].includes(order.status)) {
    return "paid" as const;
  }

  if (order.status === "cancelled") {
    return "failure" as const;
  }

  const mpStatusBase = order.mp_status?.split(":", 1)[0] ?? null;

  if (mpStatusBase && ["approved", "authorized"].includes(mpStatusBase)) {
    return "paid" as const;
  }

  if (mpStatusBase && ["rejected", "cancelled", "refunded", "charged_back"].includes(mpStatusBase)) {
    return "failure" as const;
  }

  return "pending" as const;
}

export async function GET(request: NextRequest) {
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

  const supabase = await createClient();
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
        paymentState: derivePaymentState(data),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
