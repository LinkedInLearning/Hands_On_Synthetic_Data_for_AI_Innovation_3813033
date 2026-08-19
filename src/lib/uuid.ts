/**
 * UUID generator that also works outside a secure context.
 *
 * `crypto.randomUUID()` is only defined on HTTPS origins and localhost, so on a
 * plain-http internal host every call site (creating a scenario, duplicating
 * one, adding a use case) would throw and the app would appear dead.
 */
export function uuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Short id for user-created use cases. */
export function shortId(prefix = "uc"): string {
  return `${prefix}-${uuid().slice(0, 8)}`;
}
