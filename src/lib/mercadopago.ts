import { MercadoPagoConfig, MerchantOrder, Payment, Preference } from "mercadopago";

export type MercadoPagoPreferenceBody = Parameters<Preference["create"]>[0]["body"];
export type MercadoPagoPreferenceResponse = Awaited<ReturnType<Preference["create"]>>;
export type MercadoPagoPaymentResponse = Awaited<ReturnType<Payment["get"]>>;
export type MercadoPagoMerchantOrderResponse = Awaited<ReturnType<MerchantOrder["get"]>>;

function getMercadoPagoClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("Missing MERCADOPAGO_ACCESS_TOKEN.");
  }

  return new MercadoPagoConfig({
    accessToken,
  });
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
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
