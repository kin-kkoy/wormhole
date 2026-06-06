import { TextStyle } from '@tiptap/extension-text-style';

/** TipTap's official TextStyle mark plus `fontSize` and `color` attributes
 *  (Packet 10). `@tiptap/extension-font-size` is not a v3 package, and we want
 *  color on the same mark so a single `<span style="font-family: …; font-size:
 *  …; color: …">` round-trips through the ProseMirror JSON we already store —
 *  no schema migration. */
export const TextStyleWithFontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => {
          const v = element.style.fontSize;
          return v ? v.replace(/['"]+/g, '') : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const fs = attributes.fontSize as string | null | undefined;
          if (!fs) return {};
          return { style: `font-size: ${fs}` };
        },
      },
      color: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.style.color || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          const c = attributes.color as string | null | undefined;
          if (!c) return {};
          return { style: `color: ${c}` };
        },
      },
    };
  },
});
