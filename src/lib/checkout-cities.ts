type UruguayCity = {
  name: string;
  latitude: number;
  longitude: number;
};

export const URUGUAY_CITIES: readonly UruguayCity[] = [
  { name: "Artigas", latitude: -30.401, longitude: -56.468 },
  { name: "Canelones", latitude: -34.5228, longitude: -56.2778 },
  { name: "Ciudad de la Costa", latitude: -34.8189, longitude: -55.9789 },
  { name: "Colonia del Sacramento", latitude: -34.4626, longitude: -57.8398 },
  { name: "Durazno", latitude: -33.3806, longitude: -56.5236 },
  { name: "Florida", latitude: -34.0956, longitude: -56.2142 },
  { name: "Fray Bentos", latitude: -33.1165, longitude: -58.3107 },
  { name: "Las Piedras", latitude: -34.731, longitude: -56.2192 },
  { name: "Maldonado", latitude: -34.9006, longitude: -54.95 },
  { name: "Melo", latitude: -32.3697, longitude: -54.1675 },
  { name: "Mercedes", latitude: -33.2524, longitude: -58.0305 },
  { name: "Minas", latitude: -34.3759, longitude: -55.2377 },
  { name: "Montevideo", latitude: -34.9011, longitude: -56.1645 },
  { name: "Paysandu", latitude: -32.3214, longitude: -58.0756 },
  { name: "Rivera", latitude: -30.9053, longitude: -55.5508 },
  { name: "Rocha", latitude: -34.4833, longitude: -54.3333 },
  { name: "Salto", latitude: -31.388, longitude: -57.9612 },
  { name: "San Carlos", latitude: -34.7912, longitude: -54.9182 },
  { name: "San Jose de Mayo", latitude: -34.3375, longitude: -56.7136 },
  { name: "Tacuarembo", latitude: -31.7333, longitude: -55.9833 },
  { name: "Treinta y Tres", latitude: -33.2333, longitude: -54.3833 },
  { name: "Trinidad", latitude: -33.5446, longitude: -56.888 },
] as const;

export const URUGUAY_CITY_NAMES = URUGUAY_CITIES.map((city) => city.name);

const CITY_NAME_SET = new Set(URUGUAY_CITY_NAMES);
const CITY_COORDINATES = new Map(
  URUGUAY_CITIES.map((city) => [city.name, { latitude: city.latitude, longitude: city.longitude }])
);

export function isUruguayCity(value: string): boolean {
  return CITY_NAME_SET.has(value);
}

export function getUruguayCityCoordinates(cityName: string) {
  return CITY_COORDINATES.get(cityName) ?? null;
}
