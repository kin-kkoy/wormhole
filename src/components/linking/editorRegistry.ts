import type { Editor } from '@tiptap/react';

/** Registry of live TipTap editor instances so global UI (the broken-link
 *  repair menu) can find the editor that owns a given DOM node and dispatch
 *  transactions against it. Read-only surfaces never register, so lookups
 *  from the peek panel / read mode return null and the caller degrades to
 *  restore-only actions. */
const editors = new Set<Editor>();

export function registerEditor(editor: Editor): void {
  editors.add(editor);
}

export function unregisterEditor(editor: Editor): void {
  editors.delete(editor);
}

/** Find the editable editor whose document contains `el`, if any. */
export function findEditorForElement(el: HTMLElement): Editor | null {
  for (const editor of editors) {
    if (editor.isDestroyed) continue;
    if (!editor.isEditable) continue;
    if (editor.view.dom.contains(el)) return editor;
  }
  return null;
}
