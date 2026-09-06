import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  FlipHorizontal2,
  FlipVertical2,
  Image as ImageIcon,
  RotateCw,
  Upload,
} from 'lucide-react';
import { Button, EmptyState, IconButton, InlineAlert, nimiToast, StatusBadge } from '@nimiplatform/kit/ui';
import type { OwnerPortfolioPersonaDetail } from './portfolio-data.js';
import { appendLocalCreativeAssetHistory } from './creative-asset-history.js';
import { useStudioI18n } from '../../i18n/use-studio-i18n.js';
import type { StudioCopyKey } from '../../i18n/studio-copy.js';
import {
  applyVisualImageEffects,
  buildVisualImageCssFilter,
  buildVisualImageEditDetail,
  clampVisualImageOffset,
  computeVisualImageCoverScale,
  computeVisualImageExportScale,
  computeVisualImageFrameSize,
  DEFAULT_VISUAL_IMAGE_ASPECT,
  DEFAULT_VISUAL_IMAGE_EFFECTS,
  resolveVisualImageAspect,
  VISUAL_IMAGE_ASPECTS,
  VISUAL_IMAGE_EFFECT_PRESETS,
  type VisualImageAspectId,
  type VisualImageEffectPresetId,
  type VisualImageEffects,
  type VisualImageOffset,
  type VisualImageRotation,
} from './visual-image-edit.js';

const VISUAL_IMAGE_EDIT_SOURCE = 'realm-persona-studio.local-image-edit';
const MAX_ZOOM = 3;

type VisualImageSourceKind = 'current' | 'upload';

type AdjustmentKey = 'brightness' | 'contrast' | 'saturate' | 'grayscale' | 'sepia' | 'hueRotate';

const ADJUSTMENTS: readonly {
  key: AdjustmentKey;
  labelKey: StudioCopyKey;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}[] = [
  { key: 'brightness', labelKey: 'assets.imageEditor.adjust.brightness', min: 0.2, max: 2, step: 0.01, format: (value) => String(Math.round(value * 100)) },
  { key: 'contrast', labelKey: 'assets.imageEditor.adjust.contrast', min: 0.2, max: 2, step: 0.01, format: (value) => String(Math.round(value * 100)) },
  { key: 'saturate', labelKey: 'assets.imageEditor.adjust.saturate', min: 0, max: 2, step: 0.01, format: (value) => String(Math.round(value * 100)) },
  { key: 'grayscale', labelKey: 'assets.imageEditor.adjust.grayscale', min: 0, max: 1, step: 0.01, format: (value) => String(Math.round(value * 100)) },
  { key: 'sepia', labelKey: 'assets.imageEditor.adjust.sepia', min: 0, max: 1, step: 0.01, format: (value) => String(Math.round(value * 100)) },
  { key: 'hueRotate', labelKey: 'assets.imageEditor.adjust.hueRotate', min: 0, max: 360, step: 1, format: (value) => String(Math.round(value)) },
];

function effectsEqual(left: VisualImageEffects, right: VisualImageEffects): boolean {
  return Math.abs(left.brightness - right.brightness) < 0.001
    && Math.abs(left.contrast - right.contrast) < 0.001
    && Math.abs(left.saturate - right.saturate) < 0.001
    && Math.abs(left.grayscale - right.grayscale) < 0.001
    && Math.abs(left.sepia - right.sepia) < 0.001
    && Math.abs(left.hueRotate - right.hueRotate) < 0.001;
}

function exportEditedVisualImage(
  image: HTMLImageElement,
  params: {
    naturalWidth: number;
    naturalHeight: number;
    rotation: VisualImageRotation;
    flipHorizontal: boolean;
    flipVertical: boolean;
    displayScale: number;
    offset: VisualImageOffset;
    frameWidth: number;
    frameHeight: number;
    effects: VisualImageEffects;
  },
): string | null {
  const exportScale = computeVisualImageExportScale(params.displayScale, params.frameWidth, params.frameHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(params.frameWidth * exportScale));
  canvas.height = Math.max(1, Math.round(params.frameHeight * exportScale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(exportScale, exportScale);
  context.translate(params.offset.x, params.offset.y);
  context.scale(params.displayScale, params.displayScale);
  context.rotate((params.rotation * Math.PI) / 180);
  context.scale(params.flipHorizontal ? -1 : 1, params.flipVertical ? -1 : 1);
  context.drawImage(image, -params.naturalWidth / 2, -params.naturalHeight / 2, params.naturalWidth, params.naturalHeight);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  applyVisualImageEffects(pixels, params.effects);
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export function VisualImageEditorWorkspace({
  persona,
  onHistoryUpdated,
}: {
  persona: OwnerPortfolioPersonaDetail;
  onHistoryUpdated: () => Promise<void>;
}) {
  const { t } = useStudioI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [frameMaxEdge, setFrameMaxEdge] = useState(420);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: VisualImageOffset } | null>(null);
  const hasCurrent = Boolean(persona.avatarUrl);
  const [sourceKind, setSourceKind] = useState<VisualImageSourceKind | null>(hasCurrent ? 'current' : null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [aspectId, setAspectId] = useState<VisualImageAspectId>(DEFAULT_VISUAL_IMAGE_ASPECT);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<VisualImageOffset>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<VisualImageRotation>(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [effects, setEffects] = useState<VisualImageEffects>({ ...DEFAULT_VISUAL_IMAGE_EFFECTS });
  const [isSaving, setIsSaving] = useState(false);

  const sourceUrl = sourceKind === 'current' ? persona.avatarUrl || null : uploadedPreviewUrl;
  const aspect = resolveVisualImageAspect(aspectId);
  const frame = useMemo(() => computeVisualImageFrameSize(aspect, frameMaxEdge), [aspect, frameMaxEdge]);
  const coverScale = imageSize
    ? computeVisualImageCoverScale(imageSize.width, imageSize.height, rotation, frame.width, frame.height)
    : 1;
  const displayScale = coverScale * zoom;
  const activePresetId = useMemo<VisualImageEffectPresetId | null>(() => {
    const preset = VISUAL_IMAGE_EFFECT_PRESETS.find((candidate) => effectsEqual(candidate.effects, effects));
    return preset ? preset.id : null;
  }, [effects]);

  const clampOffset = useCallback(
    (next: VisualImageOffset, nextZoom: number) => {
      if (!imageSize) return { x: 0, y: 0 };
      return clampVisualImageOffset(
        next,
        imageSize.width,
        imageSize.height,
        rotation,
        computeVisualImageCoverScale(imageSize.width, imageSize.height, rotation, frame.width, frame.height) * nextZoom,
        frame.width,
        frame.height,
      );
    },
    [frame.height, frame.width, imageSize, rotation],
  );

  useEffect(() => () => {
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
  }, [uploadedPreviewUrl]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 2) {
        setFrameMaxEdge(Math.min(420, Math.floor(entry.contentRect.width - 2)));
        setOffset({ x: 0, y: 0 });
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [sourceUrl]);

  function resetEditState() {
    setAspectId(DEFAULT_VISUAL_IMAGE_ASPECT);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    setEffects({ ...DEFAULT_VISUAL_IMAGE_EFFECTS });
    dragRef.current = null;
  }

  function selectSource(next: VisualImageSourceKind) {
    if (next === sourceKind) return;
    if (next === 'upload' && !uploadedPreviewUrl) {
      fileInputRef.current?.click();
      return;
    }
    setSourceKind(next);
    setImageSize(null);
    setImageLoadFailed(false);
    resetEditState();
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.toLowerCase().startsWith('image/')) {
      nimiToast.danger(t('assets.visualChange.uploadInvalid'));
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    setUploadedPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextPreviewUrl;
    });
    setSourceKind('upload');
    setImageSize(null);
    setImageLoadFailed(false);
    resetEditState();
  }

  function selectAspect(next: VisualImageAspectId) {
    setAspectId(next);
    setOffset({ x: 0, y: 0 });
  }

  function updateZoom(nextZoom: number) {
    setZoom(nextZoom);
    setOffset((current) => clampOffset(current, nextZoom));
  }

  function rotateImage() {
    setRotation((current) => ((current + 90) % 360) as VisualImageRotation);
    setOffset({ x: 0, y: 0 });
  }

  function updateAdjustment(key: AdjustmentKey, value: number) {
    setEffects((current) => ({ ...current, [key]: value }));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!imageSize || imageLoadFailed) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: offset };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(clampOffset({
      x: drag.origin.x + (event.clientX - drag.startX),
      y: drag.origin.y + (event.clientY - drag.startY),
    }, zoom));
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  async function saveEditedCandidate() {
    const image = imageRef.current;
    if (!image || !imageSize || !sourceUrl || isSaving || imageLoadFailed) return;
    setIsSaving(true);
    try {
      const dataUrl = exportEditedVisualImage(image, {
        naturalWidth: imageSize.width,
        naturalHeight: imageSize.height,
        rotation,
        flipHorizontal,
        flipVertical,
        displayScale,
        offset,
        frameWidth: frame.width,
        frameHeight: frame.height,
        effects,
      });
      if (!dataUrl) {
        nimiToast.danger(t('assets.imageEditor.exportFailed'));
        return;
      }
      const persisted = await appendLocalCreativeAssetHistory(persona.id, {
        sourceContentHash: persona.contentHash,
        kind: 'local-image-edit-candidate',
        sourceKind: 'imported',
        reviewState: 'owner-reviewed',
        label: 'Local image edit candidate',
        source: VISUAL_IMAGE_EDIT_SOURCE,
        previewUrl: dataUrl,
        detail: buildVisualImageEditDetail({
          aspectId,
          rotation,
          flipHorizontal,
          flipVertical,
          effects,
          presetId: activePresetId,
        }),
      });
      if (!persisted.ok) {
        nimiToast.danger(t('assets.history.persistFailed'));
        return;
      }
      nimiToast.success(t('assets.imageEditor.saved'));
      await onHistoryUpdated();
    } catch {
      nimiToast.danger(t('assets.imageEditor.exportFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  const saveDisabled = !sourceUrl || !imageSize || imageLoadFailed || isSaving;

  return (
    <div className="ras-image-editor" data-testid="visual-image-editor">
      <input
        ref={fileInputRef}
        className="ras-image-editor__file-input"
        type="file"
        accept="image/*"
        aria-label={t('assets.imageEditor.uploadAriaLabel')}
        onChange={handleUploadChange}
      />

      {!sourceUrl ? (
        <div className="ras-image-editor__empty">
          <EmptyState
            icon={<ImageIcon size={24} strokeWidth={1.7} />}
            title={t('assets.imageEditor.emptyTitle')}
            description={t('assets.imageEditor.emptyDescription')}
          />
          <Button
            tone="primary"
            size="sm"
            leadingIcon={<Upload size={16} strokeWidth={1.8} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('assets.imageEditor.chooseImage')}
          </Button>
        </div>
      ) : (
        <div className="ras-image-editor__body">
          <div ref={stageRef} className="ras-image-editor__stage">
            <div
              className="ras-image-editor__frame"
              style={{ width: `${frame.width}px`, height: `${frame.height}px` }}
              data-testid="visual-image-editor-frame"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              {!imageLoadFailed ? (
                <img
                  ref={imageRef}
                  src={sourceUrl}
                  crossOrigin={sourceKind === 'current' ? 'anonymous' : undefined}
                  alt={t('assets.imageEditor.previewAlt')}
                  draggable={false}
                  onLoad={(event) => {
                    const { naturalWidth, naturalHeight } = event.currentTarget;
                    if (naturalWidth > 0 && naturalHeight > 0) {
                      setImageSize({ width: naturalWidth, height: naturalHeight });
                      setImageLoadFailed(false);
                    }
                  }}
                  onError={() => {
                    setImageSize(null);
                    setImageLoadFailed(true);
                  }}
                  style={{
                    width: imageSize ? `${imageSize.width}px` : undefined,
                    height: imageSize ? `${imageSize.height}px` : undefined,
                    opacity: imageSize ? 1 : 0,
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${displayScale}) rotate(${rotation}deg) scale(${flipHorizontal ? -1 : 1}, ${flipVertical ? -1 : 1})`,
                    filter: buildVisualImageCssFilter(effects),
                  }}
                />
              ) : null}
              {imageLoadFailed ? (
                <div className="ras-image-editor__load-failed">
                  <InlineAlert tone="warning">{t('assets.imageEditor.loadFailed')}</InlineAlert>
                </div>
              ) : null}
            </div>
            <div className="ras-image-editor__truth-row">
              <StatusBadge tone="warning">{t('assets.localPreview')}</StatusBadge>
              <StatusBadge tone="neutral">{t('assets.notPublished')}</StatusBadge>
              <span>{t('assets.imageEditor.localOnlyNote')}</span>
            </div>
          </div>

          <div className="ras-image-editor__controls">
            <div className="ras-image-editor__control-group">
              <div className="ras-image-editor__chips" role="group" aria-label={t('assets.imageEditor.sourceAriaLabel')}>
                <button
                  type="button"
                  className="ras-image-editor__chip"
                  data-active={sourceKind === 'current'}
                  disabled={!hasCurrent}
                  onClick={() => selectSource('current')}
                >
                  {t('assets.imageEditor.sourceCurrent')}
                </button>
                <button
                  type="button"
                  className="ras-image-editor__chip"
                  data-active={sourceKind === 'upload'}
                  onClick={() => selectSource('upload')}
                >
                  {t('assets.imageEditor.sourceUpload')}
                </button>
              </div>
            </div>

            <div className="ras-image-editor__control-group" data-testid="visual-image-editor-crop">
              <h4>{t('assets.imageEditor.cropTitle')}</h4>
              <div className="ras-image-editor__chips" role="group" aria-label={t('assets.imageEditor.aspectLabel')}>
                {VISUAL_IMAGE_ASPECTS.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="ras-image-editor__chip"
                    data-active={candidate.id === aspectId}
                    aria-pressed={candidate.id === aspectId}
                    onClick={() => selectAspect(candidate.id)}
                  >
                    {candidate.id}
                  </button>
                ))}
              </div>
              <label className="ras-image-editor__slider">
                <span>{t('assets.imageEditor.zoom')}</span>
                <input
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => updateZoom(Number(event.currentTarget.value))}
                />
                <output>{zoom.toFixed(2)}</output>
              </label>
              <div className="ras-image-editor__icon-row">
                <IconButton
                  tone="secondary"
                  size="sm"
                  aria-label={t('assets.imageEditor.rotate')}
                  onClick={rotateImage}
                  icon={<RotateCw size={16} strokeWidth={1.8} aria-hidden="true" />}
                />
                <IconButton
                  tone="secondary"
                  size="sm"
                  aria-label={t('assets.imageEditor.flipHorizontal')}
                  data-active={flipHorizontal}
                  onClick={() => setFlipHorizontal((current) => !current)}
                  icon={<FlipHorizontal2 size={16} strokeWidth={1.8} aria-hidden="true" />}
                />
                <IconButton
                  tone="secondary"
                  size="sm"
                  aria-label={t('assets.imageEditor.flipVertical')}
                  data-active={flipVertical}
                  onClick={() => setFlipVertical((current) => !current)}
                  icon={<FlipVertical2 size={16} strokeWidth={1.8} aria-hidden="true" />}
                />
              </div>
            </div>

            <div className="ras-image-editor__control-group" data-testid="visual-image-editor-effects">
              <h4>{t('assets.imageEditor.effectsTitle')}</h4>
              <div className="ras-image-editor__chips" role="group" aria-label={t('assets.imageEditor.presetsAriaLabel')}>
                {VISUAL_IMAGE_EFFECT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="ras-image-editor__chip"
                    data-active={preset.id === activePresetId}
                    aria-pressed={preset.id === activePresetId}
                    onClick={() => setEffects({ ...preset.effects })}
                  >
                    {t(`assets.imageEditor.preset.${preset.id}` as StudioCopyKey)}
                  </button>
                ))}
              </div>
              {ADJUSTMENTS.map((adjustment) => (
                <label key={adjustment.key} className="ras-image-editor__slider">
                  <span>{t(adjustment.labelKey)}</span>
                  <input
                    type="range"
                    min={adjustment.min}
                    max={adjustment.max}
                    step={adjustment.step}
                    value={effects[adjustment.key]}
                    onChange={(event) => updateAdjustment(adjustment.key, Number(event.currentTarget.value))}
                  />
                  <output>{adjustment.format(effects[adjustment.key])}</output>
                </label>
              ))}
            </div>

            <div className="ras-image-editor__actions">
              <Button tone="ghost" size="sm" onClick={resetEditState}>
                {t('assets.imageEditor.reset')}
              </Button>
              <Button
                tone="primary"
                size="sm"
                disabled={saveDisabled}
                loading={isSaving}
                onClick={() => void saveEditedCandidate()}
              >
                {t('assets.imageEditor.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
