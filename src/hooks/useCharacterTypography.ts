// Character Codex typography. Thin wrapper over the shared typography-core +
// font-catalog (Packet 10 refactor). Public API is unchanged — downstream
// imports (FONT_LABELS, FONT_STACKS, ROLE_CONFIG, applyCharacterTypography,
// useCharacterTypography, …) keep working exactly as before.

import { makeTypography, type RoleConfig, type Settings } from '../lib/typography-core';

// Re-export the catalog so existing import sites stay valid.
export {
  FONT_LABELS,
  FONT_STACKS,
  FONT_CATEGORIES,
  FONT_KEYS,
  matchFamilyKey,
  type FontFamilyKey,
} from '../lib/font-catalog';
export type { RoleSetting } from '../lib/typography-core';

export type RoleKey = 'heading' | 'prose' | 'key' | 'value';
export type TypographySettings = Settings<RoleKey>;

export const ROLE_CONFIG: Record<RoleKey, RoleConfig> = {
  heading: {
    label: 'Headings',
    description: 'Character names, empty-state titles',
    fontVar: '--char-font-heading',
    sizeVar: '--char-size-heading',
    /* Scriptorium default: engraved display serif. Still fully
       user-overridable via the Characters typography gear. */
    defaultFamily: 'cinzel',
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
    /* Scriptorium default: the mono "micro" voice for plaque labels. */
    defaultFamily: 'jetbrains-mono',
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

const mod = makeTypography<RoleKey>({
  storePrefix: 'char-typography',
  roleConfig: ROLE_CONFIG,
  roleOrder: ROLE_ORDER,
});

export const defaultTypography = mod.defaults;
export const applyCharacterTypography = mod.apply;
export const loadCharacterTypography = mod.load;
export const saveCharacterTypography = mod.save;
export const useCharacterTypography = mod.useTypography;
