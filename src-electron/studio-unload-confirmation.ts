import { dialog, type BrowserWindow } from 'electron';

/** Electron cancels beforeunload silently unless the Host supplies a dialog. */
export function installStudioUnloadConfirmation(window: BrowserWindow, locale: string): void {
  const chinese = locale.toLowerCase().startsWith('zh');
  window.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      title: 'Realm Persona Studio',
      message: chinese ? '要放弃未保存的修改并离开吗？' : 'Discard unsaved changes and leave?',
      detail: chinese
        ? 'Studio 有未保存的修改或正在进行的操作。取消可返回工作区保存或等待完成。离开会丢弃未保存的修改，但已提交的保存操作仍可能完成。'
        : 'Studio has unsaved changes or work in progress. Cancel to return and save or wait for completion. Leaving discards unsaved edits; a save already submitted may still finish.',
      buttons: chinese ? ['取消', '放弃并离开'] : ['Cancel', 'Discard and leave'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    // This resumes the original close, quit, or reload, preserving its intent.
    if (choice === 1) event.preventDefault();
  });
}
