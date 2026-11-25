export const profileFields = {
  gateway: [],
  server: ["s"],
  laptop: [],
  ipad: ["h", "k"],
  phone: ["h", "k"],
} as const;

export type ProfileId = keyof typeof profileFields;
export type Field = "s" | "h" | "k";

export function isProfile(value: string): value is ProfileId {
  return Object.hasOwn(profileFields, value);
}
