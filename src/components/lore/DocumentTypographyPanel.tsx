// Packet 10 §4.3 — per-document lore typography. Renders as inline controls
// that sit in the document editor's toolbar row (next to H1/H2/H3/B/I…): a
// themed Body font + size picker, an "Aa" button opening the full per-role
// dialog, and a reset-to-world-default button (shown only when overridden).

import { useState } from 'react';
import { FONT_STACKS, isFontKey, type FontFamilyKey } from '../../lib/font-catalog';
import { FontFamilyPicker, FontSizePicker } from '../typography/FontControls';
import {
  LORE_ROLE_CONFIG,
  LORE_ROLE_ORDER,
  type LoreRoleKey,
  type LoreTypographySettings,
} from '../../hooks/useLoreTypography';
import type { RoleSetting } from '../../lib/typography-core';
import { LoreTypographySettings as LoreTypographyDialog } from '../../features/lore/LoreTypographySettings';

export type LoreOverrides = Partial<Record<LoreRoleKey, RoleSetting>>;

/** Parse + validate the stored JSON into a partial overrides object. */
export function parseLoreOverrides(json: string | null | undefined): LoreOverrides {
  if (!json) return {};
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const out: LoreOverrides = {};
    for (const role of LORE_ROLE_ORDER) {
      const r = obj[role] as { family?: unknown; sizeRem?: unknown } | undefined;
      if (r && isFontKey(r.family) && typeof r.sizeRem === 'number') {
        out[role] = { family: r.family, sizeRem: r.sizeRem };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Turn a partial overrides object into inline CSS-var styles, scoped to the
 *  wrapping editor div so only this document is affected. */
export function loreOverridesToStyle(ov: LoreOverrides): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const role of LORE_ROLE_ORDER) {
    const s = ov[role];
    if (!s) continue;
    const cfg = LORE_ROLE_CONFIG[role];
    style[cfg.fontVar] = FONT_STACKS[s.family];
    style[cfg.sizeVar] = `${s.sizeRem}rem`;
  }
  return style as React.CSSProperties;
}

interface Props {
  overrides: LoreOverrides;
  worldSettings: LoreTypographySettings;
  onChange: (next: LoreOverrides) => void;
  onClear: () => void;
}

/** Inline toolbar controls — render directly inside `.doc-editor__toolbar`. */
export function DocFontControls({ overrides, worldSettings, onChange, onClear }: Props) {
  const [showMore, setShowMore] = useState(false);
  const hasOverrides = Object.keys(overrides).length > 0;

  // Effective body = override if present, else world default.
  const body = overrides.body ?? worldSettings.body;
  const setBody = (partial: Partial<RoleSetting>) =>
    onChange({ ...overrides, body: { ...body, ...partial } });

  // The "More…" dialog edits a full settings object (world ⊕ overrides) and
  // stores back only the roles that diverge from the world default.
  const merged: LoreTypographySettings = {
    display: overrides.display ?? worldSettings.display,
    body: overrides.body ?? worldSettings.body,
    quote: overrides.quote ?? worldSettings.quote,
    label: overrides.label ?? worldSettings.label,
  };
  const handleMoreChange = (next: LoreTypographySettings) => {
    const out: LoreOverrides = {};
    for (const role of LORE_ROLE_ORDER) {
      const w = worldSettings[role];
      const n = next[role];
      if (n.family !== w.family || n.sizeRem !== w.sizeRem) out[role] = n;
    }
    onChange(out);
  };

  return (
    <>
      <FontFamilyPicker
        value={body.family as FontFamilyKey}
        onChange={(family) => setBody({ family })}
        title="Document body font"
      />
      <FontSizePicker
        valuePx={Math.round(body.sizeRem * 16)}
        onChange={(px) => setBody({ sizeRem: px / 16 })}
        title="Document body size"
      />
      <button
        type="button"
        className="doc-editor__tool-btn"
        onClick={() => setShowMore(true)}
        title="Per-document fonts (headings, quotes, labels)"
        aria-label="Per-document typography"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 13 L 6.5 3 L 9.5 3 L 13 13 M 5 9.5 L 11 9.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {hasOverrides && (
        <button
          type="button"
          className="doc-editor__tool-btn"
          onClick={onClear}
          title="Reset document fonts to world defaults"
          aria-label="Reset document fonts"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 8 a 5 5 0 1 0 1.6 -3.7" />
            <path d="M2.5 3 v 3 h 3" />
          </svg>
        </button>
      )}

      {showMore && (
        <LoreTypographyDialog
          settings={merged}
          onChange={handleMoreChange}
          onReset={() => {
            onClear();
            setShowMore(false);
          }}
          onClose={() => setShowMore(false)}
        />
      )}
    </>
  );
}
