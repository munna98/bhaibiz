// Aadhaar encryption (AES-GCM) and keyed hashing (HMAC-SHA256) using Web Crypto.
// Callers pass the secret in; it is read from the environment only inside server handlers.

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesKey(secret: string) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`bhaibiz-aadhaar-enc:${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function hashAadhaar(number: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(`bhaibiz-aadhaar-hash:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(number)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function encryptAadhaar(number: string, secret: string): Promise<string> {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(number));
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptAadhaar(cipher: string, secret: string): Promise<string> {
  const [v, iv, ct] = cipher.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Unreadable Aadhaar record");
  const key = await aesKey(secret);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct));
  return dec.decode(pt);
}
