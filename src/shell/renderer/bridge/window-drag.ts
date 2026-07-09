import { hasNimiShellRuntime, startWindowDrag } from './index.js';

export async function startStudioWindowDrag(): Promise<void> {
  if (!hasNimiShellRuntime()) {
    return;
  }
  try {
    await startWindowDrag();
  } catch {
    // Dragging is best-effort and must not break interaction.
  }
}
