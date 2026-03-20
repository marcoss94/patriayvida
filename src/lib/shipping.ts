import { getUruguayCityCoordinates } from "@/lib/checkout-cities";
type Coordinates = {
  latitude: number;
  longitude: number;
};

type GeocodeResult = {
  coordinates: Coordinates | null;
  source: "nominatim" | "city_fallback" | "failed";
};

const DEFAULT_STORE_COORDINATES: Coordinates = {
  latitude: -34.8862,
  longitude: -56.1121,
};

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_TIMEOUT_MS = 2500;

function parseEnvNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDistance(value: number) {
  return Math.round(value * 100) / 100;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getStoreCoordinates(): Coordinates {
  return {
    latitude: parseEnvNumber(
      process.env.STORE_LATITUDE,
      DEFAULT_STORE_COORDINATES.latitude,
    ),
    longitude: parseEnvNumber(
      process.env.STORE_LONGITUDE,
      DEFAULT_STORE_COORDINATES.longitude,
    ),
  };
}

export function calculateDistanceKm(
  origin: Coordinates,
  destination: Coordinates,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLng = toRadians(destination.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return normalizeDistance(earthRadiusKm * c);
}

export async function geocodeUruguayAddress({
  address,
  city,
}: {
  address: string;
  city: string;
}): Promise<GeocodeResult> {
  const cityFallback = getUruguayCityCoordinates(city);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, NOMINATIM_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      q: `${address}, ${city}, Uruguay`,
      format: "jsonv2",
      addressdetails: "0",
      limit: "1",
      countrycodes: "uy",
    });

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Accept-Language": "es-UY,es;q=0.9",
        "User-Agent": "patriayvida-checkout/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      if (cityFallback) {
        return { coordinates: cityFallback, source: "city_fallback" };
      }

      return { coordinates: null, source: "failed" };
    }

    const results = (await response.json().catch(() => null)) as Array<{
      lat?: string;
      lon?: string;
    }> | null;
    const firstResult = results?.[0];
    const latitude = firstResult?.lat ? Number(firstResult.lat) : NaN;
    const longitude = firstResult?.lon ? Number(firstResult.lon) : NaN;

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        coordinates: {
          latitude,
          longitude,
        },
        source: "nominatim",
      };
    }

    if (cityFallback) {
      return { coordinates: cityFallback, source: "city_fallback" };
    }

    return { coordinates: null, source: "failed" };
  } catch {
    if (cityFallback) {
      return { coordinates: cityFallback, source: "city_fallback" };
    }

    return { coordinates: null, source: "failed" };
  } finally {
    clearTimeout(timeoutId);
  }
}
