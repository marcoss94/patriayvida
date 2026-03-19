export type CheckoutPaymentState = "paid" | "failure" | "pending";

export type CheckoutPaymentStateDetail =
  | "order_paid"
  | "order_cancelled"
  | "payment_approved"
  | "payment_rejected"
  | "payment_pending"
  | "payment_unknown";

export type CheckoutOrderPaymentSnapshot = {
  status: string;
  mp_status: string | null;
};

export function derivePaymentState(order: CheckoutOrderPaymentSnapshot): {
  state: CheckoutPaymentState;
  detail: CheckoutPaymentStateDetail;
  message: string;
  shouldPoll: boolean;
} {
  if (["paid", "preparing", "shipped", "delivered"].includes(order.status)) {
    return {
      state: "paid",
      detail: "order_paid",
      message: "Pago confirmado. Tu pedido ya está en proceso.",
      shouldPoll: false,
    };
  }

  if (order.status === "cancelled") {
    return {
      state: "failure",
      detail: "order_cancelled",
      message: "La orden fue cancelada. Si querés, podés reintentar la compra.",
      shouldPoll: false,
    };
  }

  const mpStatusBase = order.mp_status?.split(":", 1)[0] ?? null;

  if (mpStatusBase && ["approved", "authorized"].includes(mpStatusBase)) {
    return {
      state: "paid",
      detail: "payment_approved",
      message: "Mercado Pago confirmó el pago. Estamos terminando de actualizar la orden.",
      shouldPoll: true,
    };
  }

  if (mpStatusBase && ["rejected", "cancelled", "refunded", "charged_back"].includes(mpStatusBase)) {
    return {
      state: "failure",
      detail: "payment_rejected",
      message: "El pago no fue acreditado. Podés reintentar cuando quieras.",
      shouldPoll: false,
    };
  }

  if (
    mpStatusBase &&
    ["pending", "in_process", "in_mediation", "action_required", "preference_created", "preference_pending"].includes(
      mpStatusBase,
    )
  ) {
    return {
      state: "pending",
      detail: "payment_pending",
      message: "Tu pago está pendiente de confirmación. Este estado puede tardar unos minutos.",
      shouldPoll: true,
    };
  }

  return {
    state: "pending",
    detail: "payment_unknown",
    message:
      "Recibimos tu orden, pero todavía no tenemos una confirmación clara del pago. Revisá Mis pedidos en unos minutos.",
    shouldPoll: true,
  };
}
