import { describe, expect, it } from 'vitest';
import {
  applyVisualImageEffects,
  buildVisualImageCssFilter,
  buildVisualImageEditDetail,
  clampVisualImageOffset,
  computeVisualImageCoverScale,
  computeVisualImageExportScale,
  computeVisualImageFrameSize,
  DEFAULT_VISUAL_IMAGE_EFFECTS,
  resolveVisualImageAspect,
  rotatedVisualImageDimensions,
  type VisualImageEffects,
} from './visual-image-edit.js';

function pixelBuffer(pixels: number[][], width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach(([r, g, b], index) => {
    data[index * 4] = r!;
    data[index * 4 + 1] = g!;
    data[index * 4 + 2] = b!;
    data[index * 4 + 3] = 255;
  });
  return { data, width, height };
}

function effects(patch: Partial<VisualImageEffects>): VisualImageEffects {
  return { ...DEFAULT_VISUAL_IMAGE_EFFECTS, ...patch };
}

describe('buildVisualImageCssFilter', () => {
  it('returns none for neutral effects', () => {
    expect(buildVisualImageCssFilter(DEFAULT_VISUAL_IMAGE_EFFECTS)).toBe('none');
  });

  it('builds a canonical-order filter string for custom effects', () => {
    expect(buildVisualImageCssFilter(effects({ brightness: 1.1, sepia: 0.3, hueRotate: 45 })))
      .toBe('brightness(1.1) sepia(0.3) hue-rotate(45deg)');
  });
});

describe('applyVisualImageEffects', () => {
  it('is a no-op for neutral effects and reports no change', () => {
    const buffer = pixelBuffer([[10, 20, 30]], 1, 1);
    expect(applyVisualImageEffects(buffer, DEFAULT_VISUAL_IMAGE_EFFECTS)).toBe(false);
    expect(Array.from(buffer.data.slice(0, 3))).toEqual([10, 20, 30]);
  });

  it('rejects malformed buffers instead of pretending success', () => {
    expect(applyVisualImageEffects({ data: new Uint8ClampedArray(2), width: 4, height: 4 }, effects({ brightness: 2 }))).toBe(false);
    expect(applyVisualImageEffects({ data: new Uint8ClampedArray(16), width: 0, height: 2 }, effects({ brightness: 2 }))).toBe(false);
  });

  it('doubles channels for brightness(2)', () => {
    const buffer = pixelBuffer([[10, 20, 30]], 1, 1);
    expect(applyVisualImageEffects(buffer, effects({ brightness: 2 }))).toBe(true);
    expect(Array.from(buffer.data.slice(0, 3))).toEqual([20, 40, 60]);
  });

  it('equalizes channels to luma for grayscale(1)', () => {
    const buffer = pixelBuffer([[200, 100, 50]], 1, 1);
    expect(applyVisualImageEffects(buffer, effects({ grayscale: 1 }))).toBe(true);
    const [r, g, b] = buffer.data;
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeGreaterThanOrEqual(116);
    expect(r).toBeLessThanOrEqual(119);
  });

  it('matches the sepia reference matrix for sepia(1)', () => {
    const buffer = pixelBuffer([[100, 100, 100]], 1, 1);
    expect(applyVisualImageEffects(buffer, effects({ sepia: 1 }))).toBe(true);
    const [r, g, b] = buffer.data;
    expect(r).toBeGreaterThanOrEqual(134);
    expect(r).toBeLessThanOrEqual(136);
    expect(g).toBeGreaterThanOrEqual(119);
    expect(g).toBeLessThanOrEqual(121);
    expect(b).toBeGreaterThanOrEqual(93);
    expect(b).toBeLessThanOrEqual(95);
  });

  it('keeps the alpha channel untouched', () => {
    const buffer = pixelBuffer([[10, 20, 30]], 1, 1);
    applyVisualImageEffects(buffer, effects({ brightness: 2, sepia: 0.5 }));
    expect(buffer.data[3]).toBe(255);
  });
});

describe('crop geometry', () => {
  it('computes frame sizes capped on the long edge', () => {
    expect(computeVisualImageFrameSize(resolveVisualImageAspect('1:1'))).toEqual({ width: 420, height: 420 });
    expect(computeVisualImageFrameSize(resolveVisualImageAspect('16:9'))).toEqual({ width: 420, height: 236 });
    expect(computeVisualImageFrameSize(resolveVisualImageAspect('9:16'))).toEqual({ width: 236, height: 420 });
  });

  it('swaps dimensions for quarter turns', () => {
    expect(rotatedVisualImageDimensions(2000, 1000, 0)).toEqual({ width: 2000, height: 1000 });
    expect(rotatedVisualImageDimensions(2000, 1000, 90)).toEqual({ width: 1000, height: 2000 });
    expect(rotatedVisualImageDimensions(2000, 1000, 270)).toEqual({ width: 1000, height: 2000 });
  });

  it('computes the cover scale against rotated dimensions', () => {
    expect(computeVisualImageCoverScale(2000, 1000, 0, 420, 420)).toBeCloseTo(0.42, 5);
    expect(computeVisualImageCoverScale(2000, 1000, 90, 420, 420)).toBeCloseTo(0.42, 5);
    expect(computeVisualImageCoverScale(0, 1000, 0, 420, 420)).toBe(1);
  });

  it('clamps pan offsets so the image always covers the frame', () => {
    expect(clampVisualImageOffset({ x: 100, y: -100 }, 1000, 1000, 0, 0.5, 420, 420)).toEqual({ x: 40, y: -40 });
    expect(clampVisualImageOffset({ x: 30, y: -30 }, 1000, 1000, 0, 0.42, 420, 420)).toEqual({ x: 0, y: 0 });
  });

  it('caps export scale at source resolution and max edge', () => {
    expect(computeVisualImageExportScale(0.215, 420, 420)).toBeCloseTo(1024 / 420, 5);
    expect(computeVisualImageExportScale(2, 420, 420)).toBeCloseTo(0.5, 5);
  });
});

describe('buildVisualImageEditDetail', () => {
  it('summarizes a plain crop', () => {
    expect(buildVisualImageEditDetail({
      aspectId: '1:1',
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      effects: DEFAULT_VISUAL_IMAGE_EFFECTS,
      presetId: 'original',
    })).toBe('crop 1:1');
  });

  it('summarizes transforms and presets', () => {
    expect(buildVisualImageEditDetail({
      aspectId: '4:3',
      rotation: 90,
      flipHorizontal: true,
      flipVertical: false,
      effects: effects({ sepia: 0.28, contrast: 1.08, saturate: 0.85, brightness: 1.02 }),
      presetId: 'film',
    })).toBe('crop 4:3 · rotate 90 · flipH · preset film');
  });

  it('marks non-preset effect changes as custom', () => {
    expect(buildVisualImageEditDetail({
      aspectId: '16:9',
      rotation: 0,
      flipHorizontal: false,
      flipVertical: true,
      effects: effects({ brightness: 1.3 }),
      presetId: null,
    })).toBe('crop 16:9 · flipV · custom effects');
  });
});
