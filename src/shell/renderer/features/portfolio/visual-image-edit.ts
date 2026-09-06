/**
 * Pure math for the local visual image editor: crop-frame geometry and
 * pixel-level effect filters. The renderer preview mirrors these numbers with
 * CSS transforms/filters, and the canvas export re-applies them so the saved
 * local candidate matches what the owner reviewed.
 */

export type VisualImageAspectId = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export type VisualImageAspect = {
  id: VisualImageAspectId;
  /** width / height */
  ratio: number;
};

export const VISUAL_IMAGE_ASPECTS: readonly VisualImageAspect[] = [
  { id: '1:1', ratio: 1 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '3:4', ratio: 3 / 4 },
  { id: '16:9', ratio: 16 / 9 },
  { id: '9:16', ratio: 9 / 16 },
];

export const DEFAULT_VISUAL_IMAGE_ASPECT: VisualImageAspectId = '1:1';

export function resolveVisualImageAspect(id: VisualImageAspectId): VisualImageAspect {
  return VISUAL_IMAGE_ASPECTS.find((aspect) => aspect.id === id) || VISUAL_IMAGE_ASPECTS[0]!;
}

export type VisualImageEffects = {
  /** 0..2, 1 is neutral */
  brightness: number;
  /** 0..2, 1 is neutral */
  contrast: number;
  /** 0..2, 1 is neutral */
  saturate: number;
  /** 0..1 */
  grayscale: number;
  /** 0..1 */
  sepia: number;
  /** degrees, 0 is neutral */
  hueRotate: number;
};

export const DEFAULT_VISUAL_IMAGE_EFFECTS: VisualImageEffects = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
};

export type VisualImageEffectPresetId = 'original' | 'bright' | 'soft' | 'film' | 'mono';

export const VISUAL_IMAGE_EFFECT_PRESETS: readonly { id: VisualImageEffectPresetId; effects: VisualImageEffects }[] = [
  { id: 'original', effects: { ...DEFAULT_VISUAL_IMAGE_EFFECTS } },
  { id: 'bright', effects: { brightness: 1.12, contrast: 1.06, saturate: 1.12, grayscale: 0, sepia: 0, hueRotate: 0 } },
  { id: 'soft', effects: { brightness: 1.05, contrast: 0.92, saturate: 0.9, grayscale: 0, sepia: 0, hueRotate: 0 } },
  { id: 'film', effects: { brightness: 1.02, contrast: 1.08, saturate: 0.85, grayscale: 0, sepia: 0.28, hueRotate: 0 } },
  { id: 'mono', effects: { brightness: 1, contrast: 1.05, saturate: 1, grayscale: 1, sepia: 0, hueRotate: 0 } },
];

const EFFECT_EPSILON = 0.0001;

export function isDefaultVisualImageEffects(effects: VisualImageEffects): boolean {
  return Math.abs(effects.brightness - 1) < EFFECT_EPSILON
    && Math.abs(effects.contrast - 1) < EFFECT_EPSILON
    && Math.abs(effects.saturate - 1) < EFFECT_EPSILON
    && Math.abs(effects.grayscale) < EFFECT_EPSILON
    && Math.abs(effects.sepia) < EFFECT_EPSILON
    && Math.abs(effects.hueRotate) < EFFECT_EPSILON;
}

function roundFilterValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** CSS filter string for the live preview; mirrors applyVisualImageEffects order. */
export function buildVisualImageCssFilter(effects: VisualImageEffects): string {
  if (isDefaultVisualImageEffects(effects)) return 'none';
  const parts: string[] = [];
  if (Math.abs(effects.brightness - 1) >= EFFECT_EPSILON) parts.push(`brightness(${roundFilterValue(effects.brightness)})`);
  if (Math.abs(effects.contrast - 1) >= EFFECT_EPSILON) parts.push(`contrast(${roundFilterValue(effects.contrast)})`);
  if (Math.abs(effects.saturate - 1) >= EFFECT_EPSILON) parts.push(`saturate(${roundFilterValue(effects.saturate)})`);
  if (effects.grayscale >= EFFECT_EPSILON) parts.push(`grayscale(${roundFilterValue(effects.grayscale)})`);
  if (effects.sepia >= EFFECT_EPSILON) parts.push(`sepia(${roundFilterValue(effects.sepia)})`);
  if (Math.abs(effects.hueRotate) >= EFFECT_EPSILON) parts.push(`hue-rotate(${roundFilterValue(effects.hueRotate)}deg)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
}

/** 3x4 affine color matrix: [r,g,b,offset] rows applied to rgb. */
type ColorMatrix = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
];

const IDENTITY_MATRIX: ColorMatrix = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
];

/** left ∘ right — applies `right` first, then `left`. */
function multiplyColorMatrix(left: ColorMatrix, right: ColorMatrix): ColorMatrix {
  const out = IDENTITY_MATRIX.map((row) => [...row] as [number, number, number, number]) as ColorMatrix;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      out[r]![c] = left[r]![0]! * right[0]![c]! + left[r]![1]! * right[1]![c]! + left[r]![2]! * right[2]![c]!;
    }
    out[r]![3] = left[r]![0]! * right[0]![3]! + left[r]![1]! * right[1]![3]! + left[r]![2]! * right[2]![3]! + left[r]![3]!;
  }
  return out;
}

function brightnessMatrix(value: number): ColorMatrix {
  return [
    [value, 0, 0, 0],
    [0, value, 0, 0],
    [0, 0, value, 0],
  ];
}

function contrastMatrix(value: number): ColorMatrix {
  const offset = 127.5 * (1 - value);
  return [
    [value, 0, 0, offset],
    [0, value, 0, offset],
    [0, 0, value, offset],
  ];
}

function saturateMatrix(value: number): ColorMatrix {
  return [
    [0.213 + 0.787 * value, 0.715 - 0.715 * value, 0.072 - 0.072 * value, 0],
    [0.213 - 0.213 * value, 0.715 + 0.285 * value, 0.072 - 0.072 * value, 0],
    [0.213 - 0.213 * value, 0.715 - 0.715 * value, 0.072 + 0.928 * value, 0],
  ];
}

const SEPIA_MATRIX: ColorMatrix = [
  [0.393, 0.769, 0.189, 0],
  [0.349, 0.686, 0.168, 0],
  [0.272, 0.534, 0.131, 0],
];

function lerpMatrix(target: ColorMatrix, amount: number): ColorMatrix {
  const out = IDENTITY_MATRIX.map((row) => [...row] as [number, number, number, number]) as ColorMatrix;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      out[r]![c] = IDENTITY_MATRIX[r]![c]! + (target[r]![c]! - IDENTITY_MATRIX[r]![c]!) * amount;
    }
  }
  return out;
}

function hueRotateMatrix(degrees: number): ColorMatrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    [0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928, 0],
    [0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283, 0],
    [0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072, 0],
  ];
}

export function buildVisualImageColorMatrix(effects: VisualImageEffects): ColorMatrix {
  let matrix = IDENTITY_MATRIX;
  // Keep this order in sync with buildVisualImageCssFilter.
  matrix = multiplyColorMatrix(brightnessMatrix(effects.brightness), matrix);
  matrix = multiplyColorMatrix(contrastMatrix(effects.contrast), matrix);
  matrix = multiplyColorMatrix(saturateMatrix(effects.saturate), matrix);
  matrix = multiplyColorMatrix(saturateMatrix(1 - effects.grayscale), matrix);
  matrix = multiplyColorMatrix(lerpMatrix(SEPIA_MATRIX, effects.sepia), matrix);
  matrix = multiplyColorMatrix(hueRotateMatrix(effects.hueRotate), matrix);
  return matrix;
}

export type VisualImagePixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

/**
 * Applies the composed effect matrix in place. Returns false when the buffer
 * shape is invalid or there was nothing to change; never throws so the export
 * path can fail closed instead of pretending an effect was applied.
 */
export function applyVisualImageEffects(pixels: VisualImagePixelBuffer, effects: VisualImageEffects): boolean {
  if (!pixels || !(pixels.data instanceof Uint8ClampedArray)) return false;
  if (pixels.width <= 0 || pixels.height <= 0) return false;
  if (pixels.data.length < pixels.width * pixels.height * 4) return false;
  if (isDefaultVisualImageEffects(effects)) return false;
  const matrix = buildVisualImageColorMatrix(effects);
  const [rowR, rowG, rowB] = matrix;
  const data = pixels.data;
  const pixelCount = pixels.width * pixels.height;
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const r = data[offset]!;
    const g = data[offset + 1]!;
    const b = data[offset + 2]!;
    data[offset] = rowR![0]! * r + rowR![1]! * g + rowR![2]! * b + rowR![3]!;
    data[offset + 1] = rowG![0]! * r + rowG![1]! * g + rowG![2]! * b + rowG![3]!;
    data[offset + 2] = rowB![0]! * r + rowB![1]! * g + rowB![2]! * b + rowB![3]!;
  }
  return true;
}

export type VisualImageRotation = 0 | 90 | 180 | 270;

export type VisualImageOffset = { x: number; y: number };

export type VisualImageFrameSize = { width: number; height: number };

/** Crop window size in css px for the given aspect, capped at maxEdge on the long side. */
export function computeVisualImageFrameSize(aspect: VisualImageAspect, maxEdge = 420): VisualImageFrameSize {
  if (aspect.ratio >= 1) {
    return { width: maxEdge, height: Math.round(maxEdge / aspect.ratio) };
  }
  return { width: Math.round(maxEdge * aspect.ratio), height: maxEdge };
}

function normalizedRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

export function rotatedVisualImageDimensions(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number,
): VisualImageFrameSize {
  return normalizedRotation(rotation) % 180 === 0
    ? { width: naturalWidth, height: naturalHeight }
    : { width: naturalHeight, height: naturalWidth };
}

/** Scale that makes the rotated image exactly cover the crop frame (zoom = 1). */
export function computeVisualImageCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  rotation: number,
  frameWidth: number,
  frameHeight: number,
): number {
  const rotated = rotatedVisualImageDimensions(naturalWidth, naturalHeight, rotation);
  if (rotated.width <= 0 || rotated.height <= 0 || frameWidth <= 0 || frameHeight <= 0) return 1;
  return Math.max(frameWidth / rotated.width, frameHeight / rotated.height);
}

/** Keeps the panned offset inside the range where the rotated image still covers the frame. */
export function clampVisualImageOffset(
  offset: VisualImageOffset,
  naturalWidth: number,
  naturalHeight: number,
  rotation: number,
  displayScale: number,
  frameWidth: number,
  frameHeight: number,
): VisualImageOffset {
  const rotated = rotatedVisualImageDimensions(naturalWidth, naturalHeight, rotation);
  const excessX = Math.max(0, (rotated.width * displayScale - frameWidth) / 2);
  const excessY = Math.max(0, (rotated.height * displayScale - frameHeight) / 2);
  return {
    // `|| 0` normalizes -0 so exact-cover frames report a clean zero offset.
    x: Math.min(excessX, Math.max(-excessX, offset.x)) || 0,
    y: Math.min(excessY, Math.max(-excessY, offset.y)) || 0,
  };
}

/**
 * Output-px per frame-css-px for export. Never upscales past the source
 * resolution inside the crop window and caps the long edge at maxEdge.
 */
export function computeVisualImageExportScale(
  displayScale: number,
  frameWidth: number,
  frameHeight: number,
  maxEdge = 1024,
): number {
  if (frameWidth <= 0 || frameHeight <= 0) return 1;
  const sourceCap = displayScale > 0 ? 1 / displayScale : 1;
  const edgeCap = maxEdge / Math.max(frameWidth, frameHeight);
  return Math.max(0.01, Math.min(sourceCap, edgeCap));
}

export function buildVisualImageEditDetail(input: {
  aspectId: VisualImageAspectId;
  rotation: VisualImageRotation;
  flipHorizontal: boolean;
  flipVertical: boolean;
  effects: VisualImageEffects;
  presetId: VisualImageEffectPresetId | null;
}): string {
  const parts = [`crop ${input.aspectId}`];
  if (input.rotation !== 0) parts.push(`rotate ${input.rotation}`);
  if (input.flipHorizontal) parts.push('flipH');
  if (input.flipVertical) parts.push('flipV');
  if (input.presetId && input.presetId !== 'original') parts.push(`preset ${input.presetId}`);
  else if (!isDefaultVisualImageEffects(input.effects)) parts.push('custom effects');
  return parts.join(' · ');
}
