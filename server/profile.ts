import { profileFields, type ProfileId } from "../shared/profiles";

const skeletons = import.meta.glob<string>("../profiles/*.yaml", {
  eager: true, query: "?raw", import: "default",
});

export class ProfileInputError extends Error {}

export interface ProfileSecrets {
  DOH_URL: string;
  MAIN_SUBSCRIPTION_URL: string;
  TAILSCALE_CONTROL_URL: string;
  PUBLIC_BASE_URL: string;
}

export function renderProfile(id: ProfileId, params: URLSearchParams, env: ProfileSecrets) {
  const values: Record<string, string> = {
    subscription: env.MAIN_SUBSCRIPTION_URL,
    doh_url: env.DOH_URL,
    control_url: env.TAILSCALE_CONTROL_URL,
    public_base_url: env.PUBLIC_BASE_URL?.replace(/\/+$/, ""),
  };
  for (const field of profileFields[id]) {
    const value = params.get(field)?.trim();
    if (!value) throw new ProfileInputError("Missing required value: " + field);
    values[field] = value;
  }
  return skeletons["../profiles/" + id + ".yaml"].replace(/\{\{\{(\w+)\}\}\}/g, (_, key: string) => {
    if (!values[key]) throw new Error("Missing profile configuration");
    return JSON.stringify(values[key]).slice(1, -1);
  });
}
