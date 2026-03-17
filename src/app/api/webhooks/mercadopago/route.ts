import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // TODO: Handle Mercado Pago webhook notifications
  return NextResponse.json({ received: true });
}
