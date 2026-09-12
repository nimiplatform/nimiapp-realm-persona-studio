import { normalizeDisplaySafeHttpsUrl } from './persona-external-ref.js';

export function referenceImageArtifactId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
    && new TextEncoder().encode(value).length <= 128
    && !Array.from(value).some((char) => char.charCodeAt(0) <= 31 || char.charCodeAt(0) === 127)
    ? value : undefined;
}

// @nimi-authority: rule.realm-persona-studio.asset.r014
export function referenceImageCandidatePreviewUrl(value: unknown, artifactId?: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  const publicUrl = normalizeDisplaySafeHttpsUrl(normalized);
  if (publicUrl) return publicUrl;
  return referenceImageArtifactId(artifactId)
    && /^data:image\/(?:png|jpeg|webp|gif);base64,/u.test(normalized) ? normalized : '';
}
