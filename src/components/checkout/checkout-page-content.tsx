"use client";

import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  MapPin,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/layout/page-container";
import { URUGUAY_CITY_NAMES, isUruguayCity } from "@/lib/checkout-cities";
import {
  canOfferPickup,
  checkoutPayloadSchema,
  getShippingCost,
  type DeliveryMethod,
  type CheckoutStoreConfig,
} from "@/lib/checkout";
import { formatOrderDateCompact, getOrderStatusMeta, getPaymentStatusMeta } from "@/lib/orders";
import { SHIPPING_BASE_UYU } from "@/lib/shipping-pricing";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/currency";
import { useCart } from "@/stores/cart-store";
import type { ZodIssue } from "zod";

type CheckoutPageContentProps = {
  userEmail: string;
  profile: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
  };
  storeConfig: CheckoutStoreConfig;
  returnOrderId: string | null;
  checkoutStatus: string | null;
  orderReference: string | null;
  paymentId: string | null;
};

type CheckoutApiSuccess = {
  orderId: string;
  preferenceId: string;
  initPoint: string;
  total: number;
};

type CheckoutFieldErrors = Partial<Record<string, string>>;

type ShippingQuote = {
  shippingCost: number;
  distanceKm: number | null;
  geocodeSource: string | null;
  shippingRule: string;
};

type CheckoutPaymentState = "paid" | "pending" | "failure";

type CheckoutPaymentStateDetail =
  | "order_paid"
  | "order_cancelled"
  | "payment_approved"
  | "payment_rejected"
  | "payment_abandoned"
  | "payment_timeout"
  | "payment_pending"
  | "payment_unknown";

type CheckoutOrderStatus = {
  id: string;
  status: string;
  mpStatus: string | null;
  mpPaymentId: string | null;
  mpPreferenceId: string | null;
  total: number;
  updatedAt: string;
  paymentState: CheckoutPaymentState;
  paymentStateDetail?: CheckoutPaymentStateDetail;
  paymentMessage?: string;
  shouldPoll?: boolean;
};

const PENDING_CHECKOUT_STORAGE_KEY = "patriayvida-pending-checkout";
const RETURN_STATUS_POLL_MS = 2500;
const RETURN_STATUS_MAX_ATTEMPTS = 7;
const primaryCtaClass =
  "h-11 w-full text-base font-semibold";
const secondaryCtaClass =
  "h-11 w-full border-slate-700 bg-transparent text-base font-semibold text-slate-200 hover:border-red-700 hover:bg-red-700 hover:text-white";

export function CheckoutPageContent({
  userEmail,
  profile,
  storeConfig,
  returnOrderId,
  checkoutStatus,
  orderReference,
  paymentId,
}: CheckoutPageContentProps) {
  const { cart, isHydrated, itemCount, subtotal, clearItems } = useCart();
  const pickupAvailable = canOfferPickup(storeConfig);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("shipping");
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(userEmail);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [city, setCity] = useState(isUruguayCity(profile.city) ? profile.city : "");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
  const [shippingQuoteError, setShippingQuoteError] = useState<string | null>(null);
  const resolvedReturnOrderId = returnOrderId ?? orderReference;
  const hasCheckoutReturn = Boolean(resolvedReturnOrderId || checkoutStatus || paymentId);
  const [returnOrderStatus, setReturnOrderStatus] = useState<CheckoutOrderStatus | null>(null);
  const [returnStatusLoading, setReturnStatusLoading] = useState(
    hasCheckoutReturn && Boolean(resolvedReturnOrderId)
  );
  const [returnStatusError, setReturnStatusError] = useState<string | null>(
    hasCheckoutReturn && !resolvedReturnOrderId
      ? "No pudimos confirmar el estado del pago desde este enlace. Revisalo en Mis pedidos."
      : null
  );
  const [returnPollCount, setReturnPollCount] = useState(0);
  const [cartClearedForPaidOrder, setCartClearedForPaidOrder] = useState(false);

  const shippingCost = useMemo(() => {
    if (deliveryMethod === "pickup") {
      return 0;
    }

    if (shippingQuote) {
      return shippingQuote.shippingCost;
    }

    return getShippingCost({
      deliveryMethod,
      distanceKm: null,
    });
  }, [deliveryMethod, shippingQuote]);
  const total = subtotal + shippingCost;

  useEffect(() => {
    if (deliveryMethod !== "shipping") {
      setShippingQuote(null);
      setShippingQuoteError(null);
      setShippingQuoteLoading(false);
      return;
    }

    if (!city || !address.trim()) {
      setShippingQuote(null);
      setShippingQuoteError(null);
      setShippingQuoteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setShippingQuoteLoading(true);

      void fetch("/api/checkout/shipping-quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryMethod,
          address,
          city,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as
            | (ShippingQuote & { error?: string })
            | null;

          if (!response.ok || !data || typeof data.shippingCost !== "number") {
            setShippingQuote(null);
            setShippingQuoteError(
              data?.error ?? "No pudimos calcular la distancia exacta. Mostramos envio base."
            );
            return;
          }

          setShippingQuote(data);
          setShippingQuoteError(null);
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return;
          }

          setShippingQuote(null);
          setShippingQuoteError("No pudimos calcular la distancia exacta. Mostramos envio base.");
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setShippingQuoteLoading(false);
          }
        });
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [address, city, deliveryMethod]);

  useEffect(() => {
    if (!hasCheckoutReturn || !resolvedReturnOrderId) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const fetchOrderStatus = async (attempt: number) => {
      if (cancelled) {
        return;
      }

      setReturnStatusLoading(true);

      try {
        const statusParams = new URLSearchParams({
          order_id: resolvedReturnOrderId,
          poll_timed_out: attempt + 1 >= RETURN_STATUS_MAX_ATTEMPTS ? "1" : "0",
        });

        if (checkoutStatus) {
          statusParams.set("checkout_status", checkoutStatus);
        }

        const response = await fetch(`/api/checkout/status?${statusParams.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as
          | { error?: string; order?: CheckoutOrderStatus }
          | null;

        if (cancelled) {
          return;
        }

        if (response.status === 404) {
          setReturnOrderStatus(null);
          setReturnStatusError(
            `No encontramos la orden ${resolvedReturnOrderId} en tu cuenta. Revisá tus pedidos antes de reintentar.`
          );
          setReturnStatusLoading(false);
          return;
        }

        if (!response.ok || !data?.order) {
          setReturnOrderStatus(null);
          setReturnStatusError(
            data?.error ?? "No pudimos consultar el estado real de la orden en este momento."
          );
          setReturnStatusLoading(false);
          return;
        }

        setReturnOrderStatus(data.order);
        setReturnStatusError(null);
        setReturnPollCount(attempt + 1);
        setReturnStatusLoading(false);

        if (
          data.order.paymentState === "pending" &&
          data.order.shouldPoll !== false &&
          attempt + 1 < RETURN_STATUS_MAX_ATTEMPTS
        ) {
          timeoutId = window.setTimeout(
            () => void fetchOrderStatus(attempt + 1),
            RETURN_STATUS_POLL_MS
          );
        }
      } catch {
        if (cancelled) {
          return;
        }

        setReturnOrderStatus(null);
        setReturnStatusError("Tuvimos un problema al actualizar tu pedido. Intentá de nuevo en unos instantes.");
        setReturnStatusLoading(false);
      }
    };

    void fetchOrderStatus(0);

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [checkoutStatus, hasCheckoutReturn, resolvedReturnOrderId]);

  useEffect(() => {
    if (!isHydrated || !returnOrderStatus || returnOrderStatus.paymentState !== "paid") {
      return;
    }

    if (!shouldClearCartForOrder(returnOrderStatus.id)) {
      return;
    }

    clearItems();
    clearPendingCheckoutOrderMarker();
    setCartClearedForPaidOrder(true);
  }, [clearItems, isHydrated, returnOrderStatus]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const payload = {
      deliveryMethod,
      customer: {
        fullName,
        email,
        phone,
        address,
        city,
        notes,
      },
      cart: {
        items: cart.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      },
    };

    const parsed = checkoutPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(mapZodIssues(parsed.error.issues));
      setSubmitError(parsed.error.issues[0]?.message ?? "Revisá los datos del formulario.");
      return;
    }

    if (payload.cart.items.length === 0) {
      setSubmitError("Tu carrito está vacío. Volvé al catálogo antes de pagar.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | CheckoutApiSuccess
        | { error?: string }
        | null;

      if (!response.ok || !data || !("initPoint" in data)) {
        const errorMessage = data && "error" in data ? data.error : undefined;
        setSubmitError(errorMessage ?? "No pudimos iniciar el checkout.");
        return;
      }

      storePendingCheckoutOrderMarker(data.orderId);
      window.location.assign(data.initPoint);
    } catch {
      setSubmitError("Ocurrió un problema de red al intentar abrir Mercado Pago.");
    } finally {
      setLoading(false);
    }
  }

  if (!isHydrated) {
    return (
      <PageContainer className="flex min-h-[calc(100vh-8rem)] items-center py-10">
        <Card className="w-full border-slate-800 bg-slate-950/60 py-0 shadow-[0_24px_90px_rgba(10,15,30,0.5)]">
          <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
            <Badge className="w-fit bg-slate-800 text-slate-200">Preparando tu compra</Badge>
            <CardTitle className="text-3xl font-bold text-white">
              Estamos preparando tu pedido.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base text-slate-400">
              En un instante recuperamos los productos que elegiste para que puedas continuar.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    );
  }

  if (hasCheckoutReturn) {
    return (
      <CheckoutReturnView
        checkoutStatus={checkoutStatus}
        paymentId={paymentId}
        resolvedOrderId={resolvedReturnOrderId}
        order={returnOrderStatus}
        loading={returnStatusLoading}
        error={returnStatusError}
        isPolling={
          returnOrderStatus?.paymentState === "pending" &&
          returnStatusLoading &&
          returnPollCount > 0
        }
        cartClearedForPaidOrder={cartClearedForPaidOrder}
      />
    );
  }

  if (cart.items.length === 0) {
    return (
      <PageContainer className="flex min-h-[calc(100vh-8rem)] items-center py-10">
        <Card className="w-full border-slate-800 bg-slate-950/60 py-0 shadow-[0_24px_90px_rgba(10,15,30,0.5)]">
          <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
              <Badge className="w-fit bg-slate-800 text-slate-200">Carrito vacío</Badge>
              <CardTitle className="text-3xl font-bold text-white">
                Primero elegí tus prendas.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base text-slate-400">
                Sumá tus productos al carrito y volvé cuando estés lista o listo para finalizar la compra.
              </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-4 border-slate-800 bg-slate-950/80 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
            <span className="text-sm text-slate-500">Subtotal actual: {formatPrice(0)}</span>
            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
              <ActionLink
                href="/carrito"
                variant="outline"
                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
              >
                Volver al carrito
              </ActionLink>
              <ActionLink href="/productos" variant="brand" className="font-semibold">
                Ir a productos
              </ActionLink>
            </div>
          </CardFooter>
        </Card>
      </PageContainer>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,24,44,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.09),transparent_20%)]" />
      <PageContainer className="relative z-10 flex flex-col gap-8 py-8 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-800 bg-slate-950/60 p-6 shadow-[0_24px_90px_rgba(10,15,30,0.45)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <Badge className="w-fit bg-red-600/90 text-white">Finalizar compra</Badge>
                <h1 className="text-3xl font-bold text-white sm:text-4xl">
                  Estás a un paso de recibir tu pedido.
                </h1>
                <p className="max-w-2xl text-sm text-slate-400 sm:text-base">
                  Completá tus datos y continuá a Mercado Pago para terminar el pago de forma segura.
                </p>
              </div>
              <ActionLink
                href="/carrito"
                variant="outline"
                className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
              >
                <ArrowLeft data-icon="inline-start" />
                Volver al carrito
              </ActionLink>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <Card className="border-slate-800 bg-slate-950/55 py-0">
              <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
                <CardTitle className="text-2xl font-bold text-white">Datos del comprador</CardTitle>
                <CardDescription className="text-sm text-slate-400">
                  Completá esta información para coordinar la entrega y agilizar el pago.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-6 px-6 py-6 sm:px-8 sm:py-8 md:grid-cols-2">
                <Field
                  id="fullName"
                  label="Nombre completo"
                  value={fullName}
                  onChange={setFullName}
                  error={fieldErrors["customer.fullName"]}
                  placeholder="Como figura en la entrega"
                />
                <Field
                  id="email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  error={fieldErrors["customer.email"]}
                  placeholder="tu@email.com"
                />
                <Field
                  id="phone"
                  label="Teléfono"
                  value={phone}
                  onChange={setPhone}
                  error={fieldErrors["customer.phone"]}
                  placeholder="099 123 456"
                />

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-semibold text-white">Entrega</p>
                      <p className="text-sm text-slate-400">
                        Elegí cómo querés recibir el pedido. El total se recalcula en tiempo real.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <DeliveryMethodButton
                        active={deliveryMethod === "shipping"}
                        icon={<Truck className="size-4" />}
                        label="Envío"
                        onClick={() => setDeliveryMethod("shipping")}
                      />
                      {pickupAvailable ? (
                        <DeliveryMethodButton
                          active={deliveryMethod === "pickup"}
                          icon={<Store className="size-4" />}
                          label="Retiro"
                          onClick={() => setDeliveryMethod("pickup")}
                        />
                      ) : null}
                    </div>
                  </div>

                  {deliveryMethod === "pickup" && pickupAvailable ? (
                    <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                      <p className="font-semibold">Retiro en local</p>
                      <p className="mt-2 flex items-start gap-2 text-emerald-50/90">
                        <MapPin className="mt-0.5 size-4 shrink-0" />
                        <span>{storeConfig.pickupAddress}</span>
                      </p>
                      {storeConfig.pickupInstructions ? (
                        <p className="mt-2 text-emerald-50/80">{storeConfig.pickupInstructions}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field
                        id="address"
                        label="Dirección de envío"
                        value={address}
                        onChange={setAddress}
                        error={fieldErrors["customer.address"]}
                        placeholder="Calle, número, apto"
                      />
                      <CitySelectField
                        id="city"
                        label="Ciudad"
                        value={city}
                        onChange={setCity}
                        error={fieldErrors["customer.city"]}
                      />
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="notes" className="mb-2 block text-sm font-medium text-slate-100">
                    Referencias de entrega (opcional)
                  </Label>
                  <textarea
                    id="notes"
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Piso, horario, entre calles, cualquier dato útil para la entrega."
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  />
                  {fieldErrors["customer.notes"] ? (
                    <p className="mt-2 text-xs text-red-300">{fieldErrors["customer.notes"]}</p>
                  ) : null}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col items-start gap-4 border-slate-800 bg-slate-950/80 px-6 py-6 sm:px-8 sm:py-8">
                <div className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-300">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                  <p>
                    Tu pedido se confirma cuando el pago queda acreditado. Si algo interrumpe el proceso, vas a poder retomarlo sin volver a empezar.
                  </p>
                </div>
                {submitError ? (
                  <div className="w-full rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-4 text-sm text-red-100">
                    {submitError}
                  </div>
                ) : null}
                <Button
                  type="submit"
                  variant="brand"
                  disabled={loading || cart.items.length === 0}
                  className="h-12 w-full text-base font-semibold disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <CreditCard data-icon="inline-start" />
                  )}
                  {loading ? "Preparando pago..." : "Pagar con Mercado Pago"}
                </Button>
              </CardFooter>
            </Card>

            <aside className="xl:sticky xl:top-24 xl:h-fit">
              <Card className="border-slate-800 bg-slate-950/70 py-0 shadow-[0_24px_90px_rgba(10,15,30,0.45)]">
                <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
                  <Badge className="w-fit bg-red-600/90 text-white">Resumen</Badge>
                  <CardTitle className="text-2xl font-bold text-white">Orden actual</CardTitle>
                  <CardDescription className="text-sm text-slate-400">
                    Revisá tus productos, el método de entrega y el total antes de continuar.
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8">
                  <div className="flex flex-col gap-4">
                    {cart.items.map((item) => (
                      <div key={item.variantId} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{item.productName}</p>
                            <p className="text-sm text-slate-400">
                              {item.size ?? item.variantName} x {item.quantity}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-100">
                            {formatPrice(item.unitPrice * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="bg-slate-800" />
                  <SummaryRow label="Unidades" value={String(itemCount)} />
                  <div className="space-y-3">
                    <SummaryRow
                      label="Subtotal"
                      value={formatPrice(subtotal)}
                      helper="Productos en tu carrito."
                      boxed
                    />
                    <SummaryRow
                      label={deliveryMethod === "pickup" ? "Retiro" : "Envío"}
                      value={shippingCost === 0 ? "Gratis" : formatPrice(shippingCost)}
                      helper={
                        deliveryMethod === "pickup"
                          ? "Retirás sin costo adicional."
                          : shippingQuoteLoading
                            ? "Calculando distancia..."
                            : shippingQuote && shippingQuote.distanceKm !== null
                              ? `Estimado con ${shippingQuote.distanceKm.toFixed(2)} km (${shippingQuote.shippingRule}).`
                              : shippingQuoteError
                                ? `Sin geocodificación exacta: aplicamos envío base (${formatPrice(SHIPPING_BASE_UYU)}).`
                                : "Completá dirección y ciudad para estimar el envío."
                      }
                      boxed
                    />
                    <SummaryRow
                      label="Total"
                      value={formatPrice(total)}
                      helper="Total estimado a pagar antes de ir a Mercado Pago."
                      prominent
                      boxed
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4 border-slate-800 bg-slate-950/80 px-6 py-6 text-sm text-slate-400 sm:px-8 sm:py-8">
                  <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4">
                    <p className="font-semibold text-white">Pago seguro con Mercado Pago</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Vas a continuar en una ventana segura para completar el pago y volver después a tu pedido.
                    </p>
                  </div>
                  <ActionLink
                    href="/productos"
                    variant="outline"
                    className={secondaryCtaClass}
                  >
                    Seguir comprando
                  </ActionLink>
                </CardFooter>
              </Card>
            </aside>
          </form>
        </section>
      </PageContainer>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-100">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-11 rounded-xl border-slate-700 bg-slate-900/60 px-4 text-slate-100 placeholder:text-slate-500 focus:border-red-500",
          error ? "border-red-500/60 focus:ring-red-500/20" : ""
        )}
      />
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function CitySelectField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-100">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-slate-100 outline-none transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500/20",
          error ? "border-red-500/60" : ""
        )}
      >
        <option value="" className="bg-slate-900 text-slate-400">
          Selecciona una ciudad
        </option>
        {URUGUAY_CITY_NAMES.map((cityName) => (
          <option key={cityName} value={cityName} className="bg-slate-900 text-slate-100">
            {cityName}
          </option>
        ))}
      </select>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

function DeliveryMethodButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-red-500 bg-red-500/12 text-white"
          : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  helper,
  prominent = false,
  boxed = false,
}: {
  label: string;
  value: string;
  helper?: string;
  prominent?: boolean;
  boxed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        boxed ? "rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4" : null,
        prominent && boxed ? "border-slate-700 bg-slate-900/75" : null
      )}
    >
      <div className="space-y-1">
        <span className={prominent ? "text-base text-slate-300" : "text-sm text-slate-400"}>{label}</span>
        {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
      </div>
      <span className={prominent ? "text-2xl font-bold text-white" : "text-sm font-medium text-slate-100"}>{value}</span>
    </div>
  );
}

function mapZodIssues(issues: ZodIssue[]): CheckoutFieldErrors {
  return issues.reduce<CheckoutFieldErrors>((accumulator, issue) => {
    const key = issue.path
      .filter((segment): segment is string | number => typeof segment === "string" || typeof segment === "number")
      .join(".");

    if (key && !accumulator[key]) {
      accumulator[key] = issue.message;
    }

    return accumulator;
  }, {});
}

function storePendingCheckoutOrderMarker(orderId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PENDING_CHECKOUT_STORAGE_KEY,
    JSON.stringify({
      orderId,
      createdAt: new Date().toISOString(),
    })
  );
}

function readPendingCheckoutOrderMarker(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as { orderId?: unknown };
    return typeof parsed.orderId === "string" && parsed.orderId.trim() ? parsed.orderId : null;
  } catch {
    return null;
  }
}

function clearPendingCheckoutOrderMarker() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
}

type ActionLinkProps = ComponentProps<typeof Link> & {
  variant?: "default" | "brand" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
};

function ActionLink({ className, variant = "default", size = "default", ...props }: ActionLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

function shouldClearCartForOrder(orderId: string): boolean {
  return readPendingCheckoutOrderMarker() === orderId;
}

function getCheckoutStatusLabel(checkoutStatus: string | null) {
  switch (checkoutStatus) {
    case "success":
      return "Pago iniciado";
    case "pending":
      return "Pago en revisión";
    case "failure":
      return "Pago no completado";
    default:
      return "Sin actualización disponible";
  }
}

function getReturnTone(paymentState: CheckoutPaymentState | "neutral") {
  switch (paymentState) {
    case "paid":
      return {
        badge: "Pago confirmado",
        panelClassName: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
      };
    case "pending":
      return {
        badge: "Estamos revisando tu pago",
        panelClassName: "border-amber-500/25 bg-amber-500/10 text-amber-100",
      };
    case "failure":
      return {
        badge: "Pago no acreditado",
        panelClassName: "border-red-500/25 bg-red-500/10 text-red-100",
      };
    default:
      return {
        badge: "Actualizando tu pedido",
        panelClassName: "border-slate-700 bg-slate-900/70 text-slate-200",
      };
  }
}

function CheckoutReturnView({
  checkoutStatus,
  paymentId,
  resolvedOrderId,
  order,
  loading,
  error,
  isPolling,
  cartClearedForPaidOrder,
}: {
  checkoutStatus: string | null;
  paymentId: string | null;
  resolvedOrderId: string | null;
  order: CheckoutOrderStatus | null;
  loading: boolean;
  error: string | null;
  isPolling: boolean;
  cartClearedForPaidOrder: boolean;
}) {
  const tone = getReturnTone(order?.paymentState ?? "neutral");

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,24,44,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.09),transparent_20%)]" />
      <PageContainer className="relative z-10 flex flex-col gap-6 py-8 sm:py-10">
        <Card className="border-slate-800 bg-slate-950/65 py-0 shadow-[0_24px_90px_rgba(10,15,30,0.45)]">
          <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
            <Badge className="w-fit bg-red-600/90 text-white">Estado del pedido</Badge>
            <CardTitle className="text-3xl font-bold text-white sm:text-4xl">
              Ya estamos revisando tu compra.
            </CardTitle>
            <CardDescription className="max-w-3xl text-base text-slate-400">
              En esta pantalla vas a ver la actualización más reciente de tu pedido y los próximos pasos.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-6 px-6 py-6 sm:gap-8 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className={cn("rounded-2xl border px-4 py-4 text-sm", tone.panelClassName)}>
                <p className="font-semibold">{tone.badge}</p>
                <p className="mt-2 text-sm/6">{getReturnMessage(order, error, resolvedOrderId, cartClearedForPaidOrder)}</p>
              </div>

              {loading ? (
                <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-300">
                  <Loader2 className="size-4 animate-spin" />
                  <span>
                    {order
                      ? "Estamos actualizando el estado de tu pago."
                      : "Estamos buscando la información de tu pedido."}
                  </span>
                </div>
              ) : null}

              {order ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Orden" value={order.id} />
                  <InfoCard label="Total" value={formatPrice(order.total)} />
                  <InfoCard label="Estado del pedido" value={getOrderStatusMeta(order.status).label} />
                  <InfoCard
                    label="Estado del pago"
                    value={getPaymentStatusMeta({ status: order.status, mp_status: order.mpStatus }).label}
                  />
                  <InfoCard label="Medio de pago" value={paymentId || order.mpPaymentId ? "Mercado Pago" : "A confirmar"} />
                  <InfoCard label="Actualizado" value={formatUpdatedAt(order.updatedAt)} />
                </div>
              ) : null}

              {(checkoutStatus || resolvedOrderId) && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4 text-sm text-slate-300">
                  <p className="font-semibold text-white">Seguimiento</p>
                  <p className="mt-2 text-sm/6 text-slate-400">
                    Estado recibido: {getCheckoutStatusLabel(checkoutStatus)}.
                    {resolvedOrderId ? ` Pedido: ${resolvedOrderId}.` : ""}
                    {isPolling ? " Estamos esperando una actualización final." : ""}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <ReturnActions order={order} error={error} />
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-24 flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="break-all text-sm font-medium leading-6 text-slate-100">{value}</p>
    </div>
  );
}

function ReturnActions({
  order,
  error,
}: {
  order: CheckoutOrderStatus | null;
  error: string | null;
}) {
  if (error || !order) {
    return (
        <Card className="border-slate-800 bg-slate-950/70 py-0">
          <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
          <CardTitle className="text-xl text-white">Próximo paso</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Si no vemos una actualización clara, podés seguir desde una vista estable de tu cuenta.
          </CardDescription>
        </CardHeader>
          <CardFooter className="flex flex-col gap-4 border-slate-800 bg-slate-950/80 px-6 py-6 sm:px-8 sm:py-8">
          <ActionLink href="/cuenta/pedidos" variant="brand" className="w-full">
            Ver mis pedidos
          </ActionLink>
          <ActionLink
            href="/carrito"
            variant="outline"
            className="w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
          >
            Volver al carrito
          </ActionLink>
        </CardFooter>
      </Card>
    );
  }

  if (order.paymentState === "paid") {
    return (
      <Card className="border-slate-800 bg-slate-950/70 py-0">
        <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
          <CardTitle className="text-xl text-white">Pago acreditado</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Tu compra ya quedó confirmada. Encontrá el detalle completo en Mis pedidos.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-4 border-slate-800 bg-slate-950/80 px-6 py-6 sm:px-8 sm:py-8">
          <ActionLink
            href={`/cuenta/pedidos/${order.id}`}
            variant="brand"
            className={primaryCtaClass}
          >
            Ver detalle del pedido
          </ActionLink>
          <ActionLink
            href="/productos"
            variant="outline"
            className={secondaryCtaClass}
          >
            Seguir comprando
          </ActionLink>
        </CardFooter>
      </Card>
    );
  }

  if (order.paymentState === "failure") {
    const paymentWasAbandoned = order.paymentStateDetail === "payment_abandoned";

    return (
      <Card className="border-slate-800 bg-slate-950/70 py-0">
        <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
          <CardTitle className="text-xl text-white">{paymentWasAbandoned ? "Pago cancelado" : "Podés reintentar"}</CardTitle>
          <CardDescription className="text-sm text-slate-400">
            {paymentWasAbandoned
              ? "No se registró un cobro. Podés volver al checkout para reintentar cuando quieras."
              : "Tu pedido quedó guardado, pero el pago no se acreditó. Podés revisar el carrito e intentarlo otra vez."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-4 border-slate-800 bg-slate-950/80 px-6 py-6 sm:px-8 sm:py-8">
          <ActionLink href="/checkout" variant="brand" className="w-full">
            Reintentar pago
          </ActionLink>
          <ActionLink
            href="/carrito"
            variant="outline"
            className="w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
          >
            Volver al carrito
          </ActionLink>
          <ActionLink href="/" variant="ghost" className="w-full text-slate-300 hover:text-white">
            Ir al inicio
          </ActionLink>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-950/70 py-0">
      <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8 sm:py-8">
        <CardTitle className="text-xl text-white">Estamos esperando confirmación</CardTitle>
        <CardDescription className="text-sm text-slate-400">
          Tu pago puede tardar unos instantes en reflejarse. Mientras tanto, podés seguir el estado desde el detalle del pedido.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-col gap-4 border-slate-800 bg-slate-950/80 px-6 py-6 sm:px-8 sm:py-8">
        <ActionLink
          href={`/cuenta/pedidos/${order.id}`}
          variant="brand"
          className={primaryCtaClass}
        >
          Ver detalle del pedido
        </ActionLink>
        <ActionLink
          href="/carrito"
          variant="outline"
          className="w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
        >
          Volver al carrito
        </ActionLink>
      </CardFooter>
    </Card>
  );
}

function getReturnMessage(
  order: CheckoutOrderStatus | null,
  error: string | null,
  resolvedOrderId: string | null,
  cartClearedForPaidOrder: boolean
) {
  if (error) {
    return error;
  }

  if (!order) {
    return resolvedOrderId
      ? `Estamos actualizando la información de tu pedido ${resolvedOrderId}.`
      : "Estamos actualizando la información de tu pedido.";
  }

  if (order.paymentState === "paid") {
    return cartClearedForPaidOrder
      ? "Tu pago fue confirmado y tu carrito ya quedó liberado para una próxima compra."
      : "Tu pago fue confirmado. Si seguís viendo productos en el carrito, podés vaciarlo cuando quieras.";
  }

  if (order.paymentState === "failure") {
    if (order.paymentStateDetail === "payment_abandoned") {
      return "No detectamos un pago confirmado al volver desde Mercado Pago. Si cancelaste el flujo, podés reintentarlo ahora.";
    }

    if (order.paymentStateDetail === "payment_timeout") {
      return "No llegó una confirmación final a tiempo. Si querés resolverlo ya, reintentá el pago; también podés revisar Mis pedidos.";
    }

    return "Tu pedido figura registrado, pero el pago todavía no fue acreditado. Revisalo o intentá nuevamente cuando quieras.";
  }

  if (order.paymentMessage) {
    return order.paymentMessage;
  }

  return "Tu pedido ya fue recibido. Apenas tengamos la confirmación final del pago, esta pantalla se va a actualizar.";
}


function formatUpdatedAt(value: string) {
  return formatOrderDateCompact(value);
}
