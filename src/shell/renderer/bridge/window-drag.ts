import { hasTauriInvoke, invoke } from './index.js';

export async function startStudioWindowDrag(): Promise<void> {
  if (!hasTauriInvoke()) {
    return;
  }
  try {
    await invoke('realm_persona_studio_start_window_drag', {});
  } catch {
    // Dragging is best-effort and must not break interaction.
  }
}
