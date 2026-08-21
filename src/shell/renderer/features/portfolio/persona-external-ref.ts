const CREDENTIAL_QUERY_PARAMETER = /^(?:x-amz-.+|x-goog-.+|access[_-]?token|token|api[_-]?key|apikey|key|secret|sig(?:nature)?|credential|expires?|policy|auth(?:orization)?|awsaccesskeyid|googleaccessid)$/iu;
const ENCODED_CREDENTIAL_SEPARATOR = /(?:%3f|%26|%23)(?:x-amz-[^=&%#]+|x-goog-[^=&%#]+|access[_-]?token|token|api[_-]?key|apikey|key|secret|sig(?:nature)?|credential|expires?|policy|auth(?:orization)?|awsaccesskeyid|googleaccessid)=/iu;

/** Matches the App SDK's display-safe external-reference boundary before a write is attempted. */
export function normalizeDisplaySafeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.trim() !== value) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'https:'
      || !parsed.hostname
      || parsed.username
      || parsed.password
      || parsed.hash
      || ENCODED_CREDENTIAL_SEPARATOR.test(value)
      || [...parsed.searchParams.keys()].some((name) => CREDENTIAL_QUERY_PARAMETER.test(name))
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
