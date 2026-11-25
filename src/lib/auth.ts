export type Credentials = { username: string; password: string };
export async function requestAuthContext(): Promise<Credentials> {
  const response = await fetch("/v2/auth-context", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) throw Error("cancelled");
  if (!response.ok) throw Error("unavailable");
  const data = (await response.json()) as Credentials;
  if (typeof data.username !== "string" || typeof data.password !== "string")
    throw Error("unavailable");
  return data;
}
