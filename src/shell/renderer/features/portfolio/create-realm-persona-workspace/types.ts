import type {
  CreateRealmPersonaDraftInput,
  ReferenceImageCandidateSlot,
} from '../create-persona-draft.js';
import type {
  CreateFlowFailure,
  CreateValidationField,
} from '../create-flow-failure.js';
import type { ReferenceImageSourceMode } from '../reference-image-source-chooser.js';
import type { AssetLibraryEntry } from '../../assets-library/asset-library-data.js';
import type { StudioCopyKey } from '../../../i18n/studio-copy.js';
import type { StudioTranslateOptions } from '../../../i18n/studio-i18n.js';

export type { CreateValidationField } from '../create-flow-failure.js';

export type CreatedRealmPersonaContext = {
  personaId: string;
  visibility: 'private' | 'unlisted' | 'public' | 'system';
  handle: string;
  displayName: string;
  selectedWorldId: string;
};

export type CreateRealmPersonaWorkspaceProps = {
  onCreated?: (context: CreatedRealmPersonaContext) => void;
  onOpenCreatedPersona?: (personaId: string, target: 'detail' | 'settings') => void;
};

export type StudioTranslator = (key: StudioCopyKey, options?: StudioTranslateOptions) => string;

export type CreateStage = 'describe' | 'review';
export type AutosaveState = 'saved' | 'saving' | 'failed';
export type DraftLoadState = 'loading' | 'ready' | 'failed';
export type SupplementKey = 'speechSupplement' | 'boundarySupplement' | 'visualSupplement';
export type PromptCopyTarget = 'seed' | 'image';
export type CreateRealmPersonaDraftPatch = {
  [Key in keyof CreateRealmPersonaDraftInput]?: CreateRealmPersonaDraftInput[Key];
};
export type CreateRealmPersonaDraftPatchInput =
  | CreateRealmPersonaDraftPatch
  | ((current: CreateRealmPersonaDraftInput) => CreateRealmPersonaDraftPatch);
export type ReferenceImageGenerationTarget = {
  mode: 'fill' | 'replace';
  slot: ReferenceImageCandidateSlot;
};
export type ReferenceAssetLoadState = 'idle' | 'loading' | 'ready' | 'failed';
export type CreateFieldErrors = Partial<Record<CreateValidationField, CreateFlowFailure>>;

export type ReferenceAssetsState = {
  loadState: ReferenceAssetLoadState;
  entries: AssetLibraryEntry[];
  unavailableCount: number;
  sourceUnavailable: boolean;
};

export const SELECT_UNSET_VALUE = '__realm_persona_studio_unset__';

export const DEFAULT_REFERENCE_IMAGE_SOURCE_MODE: ReferenceImageSourceMode | null = 'ai';
