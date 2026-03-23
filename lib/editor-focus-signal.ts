/**
 * Module-scope signal to coordinate between node creation and paste handling.
 * When a new text editor is about to mount, this flag prevents the canvas
 * paste handler from intercepting pastes that should go to the new editor.
 */

let pending = false;
let timeout: ReturnType<typeof setTimeout> | null = null;

export function setPendingEditorFocus() {
  pending = true;
  // Safety: auto-clear after 1s in case the editor never mounts
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    pending = false;
    timeout = null;
  }, 1000);
}

export function clearPendingEditorFocus() {
  pending = false;
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
}

export function isPendingEditorFocus() {
  return pending;
}
