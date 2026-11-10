// @nimi-authority: rule.realm-persona-studio.asset.r009
// Realm ids can contain ':' or '/'; managed JSON paths cannot. A fixed-size
// content key also stays within the SDK path bound for long Realm ids.
export async function personaStorageKey(personaId: string): Promise<string> {
  const id = personaId.trim();
  if (!id) throw new Error('Persona id is required for local storage.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
