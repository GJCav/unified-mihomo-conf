export const TEMPLATE_VALUE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CACHE_KEY = "mihomo-compose:template-values:v1";

export interface TemplateValues {
  gatewayServer: string;
  tailscaleHostname: string;
  tailscaleAuthKey: string;
}

interface CacheEntry {
  expiresAt: number;
  values: TemplateValues;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isTemplateValues(value: unknown): value is TemplateValues {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.gatewayServer === "string" &&
    typeof candidate.tailscaleHostname === "string" &&
    typeof candidate.tailscaleAuthKey === "string"
  );
}

function discard(storage: StorageLike): null {
  try {
    storage.removeItem(CACHE_KEY);
  } catch {
    // Browser privacy settings may make storage unavailable.
  }
  return null;
}

export function loadTemplateValues(
  storage: StorageLike = localStorage,
  now = Date.now(),
): TemplateValues | null {
  try {
    const serialized = storage.getItem(CACHE_KEY);
    if (!serialized) return null;
    const entry = JSON.parse(serialized) as Partial<CacheEntry>;
    if (
      typeof entry.expiresAt !== "number" ||
      entry.expiresAt <= now ||
      !isTemplateValues(entry.values)
    ) {
      return discard(storage);
    }
    return entry.values;
  } catch {
    return discard(storage);
  }
}

export function saveTemplateValues(
  values: TemplateValues,
  storage: StorageLike = localStorage,
  now = Date.now(),
): void {
  try {
    const entry: CacheEntry = {
      expiresAt: now + TEMPLATE_VALUE_CACHE_TTL_MS,
      values,
    };
    storage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // The compositor remains usable when persistent storage is unavailable.
  }
}
