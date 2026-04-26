import { TextStyle } from '@tiptap/extension-text-style';

/** TipTap's official TextStyle mark plus a `fontSize` attribute, since
 *  `@tiptap/extension-font-size` is not a v3 package. The mark renders as
 *  `<span style="font-family: …; font-size: …">`, which serializes through the
 *  ProseMirror JSON we already store — no schema migration. */
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
    };
  },
});
