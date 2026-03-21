import { MercadoPagoConfig, MerchantOrder, Payment, Preference } from "mercadopago";
import { isProductionRuntime, readOptionalEnv, requireEnv } from "@/lib/env";

export type MercadoPagoPreferenceBody = Parameters<Preference["create"]>[0]["body"];
export type MercadoPagoPreferenceResponse = Awaited<ReturnType<Preference["create"]>>;
export type MercadoPagoPaymentResponse = Awaited<ReturnType<Payment["get"]>>;
export type MercadoPagoMerchantOrderResponse = Awaited<ReturnType<MerchantOrder["get"]>>;

function getMercadoPagoClient() {
  const accessToken = requireEnv(
    "MERCADOPAGO_ACCESS_TOKEN",
    "Configure Mercado Pago credentials for checkout and webhook reconciliation."
  );

  return new MercadoPagoConfig({
    accessToken,
  });
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(readOptionalEnv("MERCADOPAGO_ACCESS_TOKEN"));
}

export type MercadoPagoWebhookSecurityMode =
  | "enforced"
  | "dev_fallback"
  | "misconfigured_production";

export function getMercadoPagoWebhookSecurityMode(): MercadoPagoWebhookSecurityMode {
  const hasWebhookSecret = getMercadoPagoWebhookSecrets().length > 0;

  if (hasWebhookSecret) {
    return "enforced";
  }

  return isProductionRuntime() ? "misconfigured_production" : "dev_fallback";
}

export function getMercadoPagoWebhookSecret() {
  return readOptionalEnv("MERCADOPAGO_WEBHOOK_SECRET");
}

export function getMercadoPagoPreviousWebhookSecret() {
  return readOptionalEnv("MERCADOPAGO_WEBHOOK_SECRET_PREVIOUS");
}

export function getMercadoPagoWebhookSecrets() {
  const primary = getMercadoPagoWebhookSecret();
  const previous = getMercadoPagoPreviousWebhookSecret();
  const unique = new Set<string>();

  if (primary) {
    unique.add(primary);
  }

  if (previous) {
    unique.add(previous);
  }

  return [...unique];
}

export async function createCheckoutProPreference(
  body: MercadoPagoPreferenceBody
): Promise<MercadoPagoPreferenceResponse> {
  const preference = new Preference(getMercadoPagoClient());
  return preference.create({ body });
}

export async function getMercadoPagoPreference(
  preferenceId: string
): Promise<MercadoPagoPreferenceResponse> {
  const preference = new Preference(getMercadoPagoClient());
  return preference.get({ preferenceId });
}

export async function getMercadoPagoPayment(
  id: string | number
): Promise<MercadoPagoPaymentResponse> {
  const payment = new Payment(getMercadoPagoClient());
  return payment.get({ id });
}

export async function getMercadoPagoMerchantOrder(
  merchantOrderId: string | number
): Promise<MercadoPagoMerchantOrderResponse> {
  const merchantOrder = new MerchantOrder(getMercadoPagoClient());
  return merchantOrder.get({ merchantOrderId });
}

export function getCheckoutRedirectUrl(
  preference: Pick<MercadoPagoPreferenceResponse, "init_point" | "sandbox_init_point">
): string | null {
  return preference.init_point ?? preference.sandbox_init_point ?? null;
}
