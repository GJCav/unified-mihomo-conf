const encoder = new TextEncoder();

function base64(value: string): string {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function digest(value: string): Promise<Uint8Array> {
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(buffer);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export function isHttps(request: Request): boolean {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  if (forwardedProtocol) return forwardedProtocol.toLowerCase() === "https";
  return new URL(request.url).protocol === "https:";
}

export function isValidCredentialSecret(secret: string | undefined): secret is string {
  if (!secret) return false;
  const separator = secret.indexOf(":");
  return separator > 0 && separator < secret.length - 1;
}

export function splitCredentials(credentials: string): {
  username: string;
  password: string;
} {
  const separator = credentials.indexOf(":");
  return {
    username: credentials.slice(0, separator),
    password: credentials.slice(separator + 1),
  };
}

export async function isAuthorized(request: Request, credentials: string): Promise<boolean> {
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Basic ${base64(credentials)}`;
  const [providedDigest, expectedDigest] = await Promise.all([
    digest(provided),
    digest(expected),
  ]);
  return constantTimeEqual(providedDigest, expectedDigest);
}
