// Packet 10 — shared font catalog. Single source of truth for every font the
// Character / Lore typography popovers and the inline bubble menu offer.
// All families are OFL, bundled offline in src/assets/fonts (see fonts.css).

export type FontFamilyKey =
  | 'cormorant'
  | 'crimson'
  | 'eb-garamond'
  | 'cinzel'
  | 'cormorant-unicase'
  | 'unifraktur'
  | 'caveat'
  | 'special-elite'
  | 'inter'
  | 'jetbrains-mono'
  | 'system-serif'
  | 'system-sans';

export const FONT_LABELS: Record<FontFamilyKey, string> = {
  cormorant: 'Cormorant Garamond',
  crimson: 'Crimson Pro',
  'eb-garamond': 'EB Garamond',
  cinzel: 'Cinzel',
  'cormorant-unicase': 'Cormorant Unicase',
  unifraktur: 'UnifrakturMaguntia',
  caveat: 'Caveat',
  'special-elite': 'Special Elite',
  inter: 'Inter',
  'jetbrains-mono': 'JetBrains Mono',
  'system-serif': 'System Serif',
  'system-sans': 'System Sans',
};

const SERIF_FALLBACK =
  "'Iowan Old Style', 'Hoefler Text', 'Palatino Linotype', Palatino, 'URW Palladio L', Georgia, serif";
const SANS_FALLBACK =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO_FALLBACK = "ui-monospace, 'SFMono-Regular', 'Courier New', monospace";

export const FONT_STACKS: Record<FontFamilyKey, string> = {
  cormorant: `'Cormorant Garamond', ${SERIF_FALLBACK}`,
  crimson: `'Crimson Pro', 'Charter', ${SERIF_FALLBACK}`,
  'eb-garamond': `'EB Garamond', ${SERIF_FALLBACK}`,
  cinzel: `'Cinzel', 'Trajan Pro', ${SERIF_FALLBACK}`,
  'cormorant-unicase': `'Cormorant Unicase', 'Cormorant Garamond', ${SERIF_FALLBACK}`,
  unifraktur: `'UnifrakturMaguntia', 'UnifrakturCook', 'Blackletter', fantasy, ${SERIF_FALLBACK}`,
  caveat: `'Caveat', 'Segoe Script', 'Bradley Hand', cursive`,
  'special-elite': `'Special Elite', 'Courier New', ${MONO_FALLBACK}`,
  inter: `'Inter', ${SANS_FALLBACK}`,
  'jetbrains-mono': `'JetBrains Mono', ${MONO_FALLBACK}`,
  'system-serif': SERIF_FALLBACK,
  'system-sans': SANS_FALLBACK,
};

export interface FontCategory {
  label: string;
  fonts: FontFamilyKey[];
}

/** Ordered, grouped catalog for the picker dropdowns (§4.5). */
export const FONT_CATEGORIES: FontCategory[] = [
  { label: 'Serif', fonts: ['cormorant', 'crimson', 'eb-garamond'] },
  { label: 'Display', fonts: ['cinzel', 'cormorant-unicase'] },
  { label: 'Decorative', fonts: ['unifraktur', 'caveat', 'special-elite'] },
  { label: 'Sans', fonts: ['inter'] },
  { label: 'Mono', fonts: ['jetbrains-mono'] },
  { label: 'System', fonts: ['system-serif', 'system-sans'] },
];

export const FONT_KEYS = Object.keys(FONT_LABELS) as FontFamilyKey[];

export function isFontKey(v: unknown): v is FontFamilyKey {
  return typeof v === 'string' && v in FONT_LABELS;
}

// Reverse map: first canonical family name (lowercased) → key, for matching a
// stored stack back to a catalog entry in the inline picker.
const FIRST_FAMILY_TO_KEY: Record<string, FontFamilyKey> = (() => {
  const map: Record<string, FontFamilyKey> = {};
  for (const key of FONT_KEYS) {
    const first = FONT_STACKS[key].split(',')[0].trim().replace(/['"]/g, '').toLowerCase();
    map[first] = key;
  }
  return map;
})();

/** Match a stored font stack to one of the catalog keys by its leading family. */
export function matchFamilyKey(stored: string | undefined): FontFamilyKey | null {
  if (!stored) return null;
  const first = stored.split(',')[0].trim().replace(/['"]/g, '').toLowerCase();
  return FIRST_FAMILY_TO_KEY[first] ?? null;
}
