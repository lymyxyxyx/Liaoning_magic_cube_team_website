const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function base64urlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSign(key: CryptoKey, data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(signature);
}

async function getAuthKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify"
  ]);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function createSessionToken(password: string): Promise<string> {
  void password;
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");

  const expiry = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = String(expiry);

  const key = await getAuthKey(secret);
  const signature = await hmacSign(key, payload);
  const sigB64 = base64urlEncode(signature);

  return `${base64urlEncode(new TextEncoder().encode(payload))}.${sigB64}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;

  try {
    const payloadBytes = base64urlDecode(token.slice(0, dotIndex));
    const payload = new TextDecoder().decode(payloadBytes);
    const expiry = parseInt(payload, 10);
    if (Number.isNaN(expiry)) return false;

    const now = Math.floor(Date.now() / 1000);
    if (now > expiry) return false;

    const key = await getAuthKey(secret);
    const expectedSig = await hmacSign(key, payload);
    const actualSig = base64urlDecode(token.slice(dotIndex + 1));

    return timingSafeEqual(expectedSig, actualSig);
  } catch {
    return false;
  }
}
