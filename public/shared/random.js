// Aleatoriedade criptográfica que funciona no Node (20+) e no navegador.
const c = globalThis.crypto;

/** randomInt(n) -> [0, n)  |  randomInt(min, max) -> [min, max) */
export function randomInt(a, b) {
  const min = b === undefined ? 0 : a;
  const max = b === undefined ? a : b;
  const range = max - min;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / range) * range;
  do { c.getRandomValues(buf); } while (buf[0] >= limit);
  return min + (buf[0] % range);
}

export function uuid() {
  if (c.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
