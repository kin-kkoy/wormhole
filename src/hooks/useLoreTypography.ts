// Packet 10 §4.1 — Lore Archive per-world typography (write mode only; Read
// Mode keeps its own --paper-* tokens). Roles: Body, Headings, Quotes, Labels.

import { makeTypography, type RoleConfig, type Settings } from '../lib/typography-core';

export type LoreRoleKey = 'display' | 'body' | 'quote' | 'label';
export type LoreTypographySettings = Settings<LoreRoleKey>;

export const LORE_ROLE_CONFIG: Record<LoreRoleKey, RoleConfig> = {
  display: {
    label: 'Headings',
    description: 'H1 / H2 / H3 inside lore documents',
    fontVar: '--lore-font-display',
    sizeVar: '--lore-size-display',
    defaultFamily: 'cormorant',
    defaultSizeRem: 2.0,
    scaleMin: 0.7,
    scaleMax: 1.6,
  },
  body: {
    label: 'Body',
    description: 'Document body prose',
    fontVar: '--lore-font-body',
    sizeVar: '--lore-size-body',
    defaultFamily: 'crimson',
    defaultSizeRem: 1.0,
    scaleMin: 0.8,
    scaleMax: 1.6,
  },
  quote: {
    label: 'Quotes',
    description: 'Blockquote styling',
    fontVar: '--lore-font-quote',
    sizeVar: '--lore-size-quote',
    defaultFamily: 'eb-garamond',
    defaultSizeRem: 1.0625,
    scaleMin: 0.8,
    scaleMax: 1.5,
  },
  label: {
    label: 'Labels / Meta',
    description: 'Folder titles, list metadata, breadcrumbs',
    fontVar: '--lore-font-label',
    sizeVar: '--lore-size-label',
    defaultFamily: 'inter',
    defaultSizeRem: 0.75,
    scaleMin: 0.85,
    scaleMax: 1.4,
  },
};

export const LORE_ROLE_ORDER: LoreRoleKey[] = ['display', 'body', 'quote', 'label'];

const mod = makeTypography<LoreRoleKey>({
  storePrefix: 'lore-typography',
  roleConfig: LORE_ROLE_CONFIG,
  roleOrder: LORE_ROLE_ORDER,
});

export const defaultLoreTypography = mod.defaults;
export const applyLoreTypography = mod.apply;
export const loadLoreTypography = mod.load;
export const saveLoreTypography = mod.save;
export const useLoreTypography = mod.useTypography;
