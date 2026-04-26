import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettingsStore } from '../lib/settings-store';

/* ---------- Font catalog ---------- */

export type FontFamilyKey =
  | 'cormorant'
  | 'crimson'
  | 'inter'
  | 'system-serif'
  | 'system-sans';

export const FONT_LABELS: Record<FontFamilyKey, string> = {
  cormorant: 'Cormorant Garamond',
  crimson: 'Crimson Pro',
  inter: 'Inter',
  'system-serif': 'System Serif',
  'system-sans': 'System Sans',
};

export const FONT_STACKS: Record<FontFamilyKey, string> = {
  cormorant:
    "'Cormorant Garamond', 'Iowan Old Style', 'Hoefler Text', 'Palatino Linotype', Palatino, 'URW Palladio L', Georgia, serif",
  crimson:
    "'Crimson Pro', 'Charter', 'Iowan Old Style', 'Palatino Linotype', Palatino, 'URW Palladio L', Georgia, serif",
  inter:
    "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'system-serif':
    "'Iowan Old Style', 'Hoefler Text', 'Palatino Linotype', Palatino, 'URW Palladio L', Georgia, serif",
  'system-sans':
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/* ---------- Role schema ---------- */

export type RoleKey = 'heading' | 'prose' | 'key' | 'value';

export interface RoleSetting {
  family: FontFamilyKey;
  sizeRem: number;
}

export type TypographySettings = Record<RoleKey, RoleSetting>;

interface RoleConfig {
  label: string;
  description: string;
  fontVar: string;
  sizeVar: string;
  defaultFamily: FontFamilyKey;
  defaultSizeRem: number;
  /** Min/max scale (multiplied against the default to bound the slider). */
  scaleMin: number;
  scaleMax: number;
  /** Compatible-feel list — every role can pick any font, but we sort the
   *  defaults so the picker reads sensibly (serifs first for serif roles). */
}

export const ROLE_CONFIG: Record<RoleKey, RoleConfig> = {
  heading: {
    label: 'Headings',
    description: 'Character names, empty-state titles',
    fontVar: '--char-font-heading',
    sizeVar: '--char-size-heading',
    defaultFamily: 'cormorant',
    defaultSizeRem: 1.5,
    scaleMin: 0.7,
    scaleMax: 1.5,
  },
  prose: {
    label: 'Prose',
    description: 'Card content, descriptions, body text',
    fontVar: '--char-font-prose',
    sizeVar: '--char-size-body',
    defaultFamily: 'crimson',
    defaultSizeRem: 0.8125,
    scaleMin: 0.85,
    scaleMax: 1.4,
  },
  key: {
    label: 'Labels',
    description: 'Eyebrows, uppercase card-block titles, dates',
    fontVar: '--char-font-key',
    sizeVar: '--char-size-label',
    defaultFamily: 'inter',
    defaultSizeRem: 0.6875,
    scaleMin: 0.85,
    scaleMax: 1.5,
  },
  value: {
    label: 'KV Values',
    description: 'Key/value row contents (right column)',
    fontVar: '--char-font-value',
    sizeVar: '--char-size-value',
    defaultFamily: 'crimson',
    defaultSizeRem: 0.8125,
    scaleMin: 0.85,
    scaleMax: 1.4,
  },
};

export const ROLE_ORDER: RoleKey[] = ['heading', 'prose', 'key', 'value'];

export function defaultTypography(): TypographySettings {
  return {
    heading: { family: ROLE_CONFIG.heading.defaultFamily, sizeRem: ROLE_CONFIG.heading.defaultSizeRem },
    prose:   { family: ROLE_CONFIG.prose.defaultFamily,   sizeRem: ROLE_CONFIG.prose.defaultSizeRem   },
    key:     { family: ROLE_CONFIG.key.defaultFamily,     sizeRem: ROLE_CONFIG.key.defaultSizeRem     },
    value:   { family: ROLE_CONFIG.value.defaultFamily,   sizeRem: ROLE_CONFIG.value.defaultSizeRem   },
  };
}

/* ---------- DOM application ---------- */

/** Push a settings object into :root CSS variables. Pass null to clear all
 *  overrides (CSS falls back to the defaults declared in typography.css). */
export function applyCharacterTypography(settings: TypographySettings | null): void {
  const root = document.documentElement;
  for (const role of ROLE_ORDER) {
    const cfg = ROLE_CONFIG[role];
    if (settings) {
      root.style.setProperty(cfg.fontVar, FONT_STACKS[settings[role].family]);
      root.style.setProperty(cfg.sizeVar, `${settings[role].sizeRem}rem`);
    } else {
      root.style.removeProperty(cfg.fontVar);
      root.style.removeProperty(cfg.sizeVar);
    }
  }
}

/* ---------- Persistence ---------- */

function storeKey(worldId: string): string {
  return `char-typography:${worldId}`;
}

function isValidSettings(v: unknown): v is TypographySettings {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return ROLE_ORDER.every((role) => {
    const r = obj[role] as { family?: unknown; sizeRem?: unknown } | undefined;
    return (
      r !== undefined &&
      typeof r === 'object' &&
      typeof r.family === 'string' &&
      r.family in FONT_LABELS &&
      typeof r.sizeRem === 'number' &&
      r.sizeRem > 0 &&
      r.sizeRem < 6
    );
  });
}

export async function loadCharacterTypography(
  worldId: string,
): Promise<TypographySettings> {
  try {
    const store = await getSettingsStore();
    const raw = await store.get<unknown>(storeKey(worldId));
    if (isValidSettings(raw)) return raw;
  } catch {
    // Fall through to defaults.
  }
  return defaultTypography();
}

export async function saveCharacterTypography(
  worldId: string,
  settings: TypographySettings,
): Promise<void> {
  try {
    const store = await getSettingsStore();
    await store.set(storeKey(worldId), settings);
    await store.save();
  } catch (e) {
    console.error('Failed to save character typography:', e);
  }
}

/* ---------- React hook ---------- */

/** Loads + applies the per-world typography settings. Returns the live state
 *  and a setter that both updates state and persists to the store. Pass null
 *  for `worldId` (e.g. on the world index) to skip loading. */
export function useCharacterTypography(worldId: string | null) {
  const [settings, setSettings] = useState<TypographySettings>(defaultTypography);
  const [loaded, setLoaded] = useState(false);
  // Slider drags fire onChange every pixel; debounce the disk write so we
  // don't spam the Tauri Store. Visual updates apply synchronously via CSS
  // vars — only the persistence is delayed.
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!worldId) {
      applyCharacterTypography(null);
      setSettings(defaultTypography());
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    loadCharacterTypography(worldId).then((s) => {
      if (cancelled) return;
      setSettings(s);
      applyCharacterTypography(s);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  // Flush any pending save on unmount (or world switch) so we don't lose the
  // last drag position if the user closes the panel mid-debounce.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [worldId]);

  const update = useCallback(
    (next: TypographySettings) => {
      setSettings(next);
      applyCharacterTypography(next);
      if (!worldId) return;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveCharacterTypography(worldId, next);
        saveTimerRef.current = null;
      }, 250);
    },
    [worldId],
  );

  const reset = useCallback(() => {
    const fresh = defaultTypography();
    update(fresh);
  }, [update]);

  return { settings, loaded, update, reset };
}
