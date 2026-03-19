export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readOptionalEnv(name: string) {
  return normalizeEnvValue(process.env[name]);
}

export function requireEnv(name: string, context: string) {
  const value = readOptionalEnv(name);

  if (!value) {
    throw new Error(`Missing required env var ${name}. ${context}`);
  }

  return value;
}

export function getMissingEnv(names: readonly string[]) {
  return names.filter((name) => !readOptionalEnv(name));
}
