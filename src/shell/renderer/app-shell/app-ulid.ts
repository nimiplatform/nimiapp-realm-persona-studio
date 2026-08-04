const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function isAppUlid(value: unknown): value is string {
  return typeof value === 'string' && ULID_PATTERN.test(value.trim());
}

function randomUlidCharacters(count: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(count);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => ULID_ALPHABET[byte % ULID_ALPHABET.length]).join('');
  }
  return Array.from({ length: count }, () => ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)]).join('');
}

export function createAppUlid(now = Date.now()): string {
  if (!Number.isFinite(now) || now < 0 || now > 281_474_976_710_655) {
    throw new Error('ULID timestamp must be a finite non-negative 48-bit millisecond value.');
  }
  let timestamp = BigInt(Math.floor(now));
  let timePart = '';
  for (let index = 0; index < 10; index += 1) {
    timePart = ULID_ALPHABET[Number(timestamp & 31n)] + timePart;
    timestamp >>= 5n;
  }
  return `${timePart}${randomUlidCharacters(16)}`;
}
