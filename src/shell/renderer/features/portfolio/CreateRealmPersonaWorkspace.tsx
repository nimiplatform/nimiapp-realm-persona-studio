/**
 * Public entry for the Realm Persona creation workspace. The implementation
 * lives in `./create-realm-persona-workspace/`; this module only re-exports it
 * so existing route imports keep working.
 */
export {
  CreateRealmPersonaWorkspace,
  countCompletedCreationDraftFields,
} from './create-realm-persona-workspace/index.js';
export type {
  CreatedRealmPersonaContext,
  CreateRealmPersonaWorkspaceProps,
} from './create-realm-persona-workspace/index.js';
