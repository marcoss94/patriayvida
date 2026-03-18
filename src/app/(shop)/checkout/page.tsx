import { redirect } from "next/navigation";
import { CheckoutPageContent } from "@/components/checkout/checkout-page-content";
import type { CheckoutStoreConfig } from "@/lib/checkout";
import { createClient } from "@/lib/supabase/server";

type CheckoutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildCheckoutReturnPath(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) {
          search.append(key, entry);
        }
      }

      continue;
    }

    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `/checkout?${query}` : "/checkout";
}

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(buildCheckoutReturnPath(params))}`);
  }

  const [{ data: profile }, { data: storeConfigRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, address, city")
      .eq("id", user.id)
      .single(),
    supabase
      .from("store_config")
      .select(
        "store_name, shipping_fixed_cost, free_shipping_threshold, pickup_address, pickup_instructions, contact_email, contact_phone"
      )
      .limit(1)
      .maybeSingle(),
  ]);

  const storeConfig: CheckoutStoreConfig = {
    storeName: storeConfigRow?.store_name ?? "Patria y Vida",
    shippingFixedCost: Number(storeConfigRow?.shipping_fixed_cost ?? 0),
    freeShippingThreshold:
      storeConfigRow?.free_shipping_threshold === null ||
      storeConfigRow?.free_shipping_threshold === undefined
        ? null
        : Number(storeConfigRow.free_shipping_threshold),
    pickupAddress: storeConfigRow?.pickup_address ?? null,
    pickupInstructions: storeConfigRow?.pickup_instructions ?? null,
    contactEmail: storeConfigRow?.contact_email ?? null,
    contactPhone: storeConfigRow?.contact_phone ?? null,
  };

  return (
    <CheckoutPageContent
      userEmail={user.email ?? ""}
      profile={{
        fullName: profile?.full_name ?? "",
        phone: profile?.phone ?? "",
        address: profile?.address ?? "",
        city: profile?.city ?? "",
      }}
      storeConfig={storeConfig}
      returnOrderId={getSingleParam(params.order_id)}
      checkoutStatus={getSingleParam(params.checkout_status)}
      orderReference={getSingleParam(params.external_reference)}
      paymentId={getSingleParam(params.payment_id)}
    />
  );
}
