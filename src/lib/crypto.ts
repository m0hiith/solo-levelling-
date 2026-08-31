/**
 * PBKDF2-HMAC-SHA256 for the login screen.
 *
 * WHY A HAND-ROLLED FALLBACK: `crypto.subtle` and `crypto.randomUUID` only exist in
 * secure contexts. `npm run dev` serves on 0.0.0.0 over plain HTTP, so when the app is
 * opened from a phone on the LAN — which is exactly how the second player uses it —
 * WebCrypto is simply absent. The JS path below is byte-for-byte compatible with
 * WebCrypto's output, so a password set on the laptop still verifies on the phone.
 *
 * SCOPE OF PROTECTION: all data lives in localStorage, readable from devtools by
 * anyone holding the unlocked device. This hashing stops a password from sitting in
 * plaintext and stops casual snooping between the two players; it is not a defence
 * against someone who has the device and wants the data.
 */

const ITERATIONS = 64_000;
const KEY_BYTES = 32;

// ── SHA-256 core ─────────────────────────────────────────

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_STATE = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/** Scratch message schedule, reused across every compression to avoid per-block allocation. */
const W = new Uint32Array(64);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** Mixes one 64-byte block of `data` at `offset` into the eight-word state `H`, in place. */
function compress(H: Uint32Array, data: Uint8Array, offset: number): void {
  for (let i = 0; i < 16; i++) {
    const j = offset + i * 4;
    W[i] = (data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3];
  }
  for (let i = 16; i < 64; i++) {
    const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
    const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }

  let [a, b, c, d, e, f, g, h] = H;

  for (let i = 0; i < 64; i++) {
    const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const ch = (e & f) ^ (~e & g);
    const temp1 = (h + S1 + ch + K[i] + W[i]) | 0;
    const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) | 0;

    h = g;
    g = f;
    f = e;
    e = (d + temp1) | 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) | 0;
  }

  H[0] = (H[0] + a) | 0;
  H[1] = (H[1] + b) | 0;
  H[2] = (H[2] + c) | 0;
  H[3] = (H[3] + d) | 0;
  H[4] = (H[4] + e) | 0;
  H[5] = (H[5] + f) | 0;
  H[6] = (H[6] + g) | 0;
  H[7] = (H[7] + h) | 0;
}

function stateToBytes(H: Uint32Array, out: Uint8Array): void {
  for (let i = 0; i < 8; i++) {
    out[i * 4] = H[i] >>> 24;
    out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
    out[i * 4 + 3] = H[i] & 0xff;
  }
}

function sha256(message: Uint8Array): Uint8Array {
  // Pad to a multiple of 64 bytes: 0x80, zeros, then the bit length as a 64-bit BE int.
  const blocks = Math.ceil((message.length + 9) / 64);
  const padded = new Uint8Array(blocks * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const bits = message.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
  view.setUint32(padded.length - 4, bits >>> 0);

  const H = INITIAL_STATE.slice();
  for (let i = 0; i < padded.length; i += 64) compress(H, padded, i);

  const out = new Uint8Array(32);
  stateToBytes(H, out);
  return out;
}

// ── HMAC with precomputed pad states ─────────────────────

/**
 * Both HMAC pads depend only on the password, so their block compressions are hoisted
 * out of the PBKDF2 loop. That halves the work per iteration — the difference between
 * a snappy login and a two-second stall on a phone.
 */
interface HmacKey {
  inner: Uint32Array;
  outer: Uint32Array;
}

function hmacKey(key: Uint8Array): HmacKey {
  const block = new Uint8Array(64);
  block.set(key.length > 64 ? sha256(key) : key);

  const pad = new Uint8Array(64);
  const inner = INITIAL_STATE.slice();
  const outer = INITIAL_STATE.slice();

  for (let i = 0; i < 64; i++) pad[i] = block[i] ^ 0x36;
  compress(inner, pad, 0);
  for (let i = 0; i < 64; i++) pad[i] = block[i] ^ 0x5c;
  compress(outer, pad, 0);

  return { inner, outer };
}

/** HMAC of a message that is at most 55 bytes, so inner and outer are one block each. */
function hmacShort(key: HmacKey, message: Uint8Array, out: Uint8Array): void {
  const block = new Uint8Array(64);
  block.set(message);
  block[message.length] = 0x80;
  // Length in bits, including the 64-byte pad block already folded into the state.
  new DataView(block.buffer).setUint32(60, (64 + message.length) * 8);

  const H = key.inner.slice();
  compress(H, block, 0);
  stateToBytes(H, out);

  block.fill(0);
  block.set(out.subarray(0, 32));
  block[32] = 0x80;
  new DataView(block.buffer).setUint32(60, (64 + 32) * 8);

  const H2 = key.outer.slice();
  compress(H2, block, 0);
  stateToBytes(H2, out);
}

/** PBKDF2 for a 32-byte key — exactly one output block, so no block loop is needed. */
function pbkdf2Js(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  const key = hmacKey(password);
  const seed = new Uint8Array(salt.length + 4);
  seed.set(salt);
  seed[salt.length + 3] = 1; // INT_32_BE(blockIndex = 1)

  const u = new Uint8Array(32);
  hmacShort(key, seed, u);
  const result = u.slice();

  for (let i = 1; i < iterations; i++) {
    hmacShort(key, u, u);
    for (let j = 0; j < 32; j++) result[j] ^= u[j];
  }
  return result;
}

// ── Public API ───────────────────────────────────────────

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Cryptographically random bytes where available, `Math.random` where it is not. */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(out);
  } else {
    for (let i = 0; i < length; i++) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

export function randomSalt(): string {
  return toHex(randomBytes(16));
}

/** Derives the stored password hash. Identical output on the WebCrypto and JS paths. */
export async function derivePasswordHash(password: string, saltHex: string): Promise<string> {
  const passwordBytes = encoder.encode(password.normalize('NFKC'));
  const salt = fromHex(saltHex);

  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle) {
    const material = await subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
      material,
      KEY_BYTES * 8,
    );
    return toHex(new Uint8Array(bits));
  }

  // Yield first so the caller's "verifying…" spinner paints before the loop blocks.
  await new Promise(resolve => setTimeout(resolve, 0));
  return toHex(pbkdf2Js(passwordBytes, salt, ITERATIONS));
}

/** Length-independent comparison, so a wrong password leaks nothing through timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * `crypto.randomUUID` is secure-context only — same LAN-over-HTTP problem as above —
 * so ids fall back to a timestamp plus randomness, which is unique enough for
 * localStorage records that never leave the device.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${toHex(randomBytes(8))}`;
}
