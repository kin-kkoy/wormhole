// Packet 10 — generic per-world typography engine. Character / Lore
// each instantiate this with their own role config + store prefix. Handles CSS
// variable application, Tauri Store persistence (debounced), and the React hook.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettingsStore } from './settings-store';
import { FONT_STACKS, isFontKey, type FontFamilyKey } from './font-catalog';

export interface RoleSetting {
  family: FontFamilyKey;
  sizeRem: number;
}

export interface RoleConfig {
  label: string;
  description: string;
  fontVar: string;
  sizeVar: string;
  defaultFamily: FontFamilyKey;
  defaultSizeRem: number;
  scaleMin: number;
  scaleMax: number;
}

export type Settings<R extends string> = Record<R, RoleSetting>;

export interface TypographyModule<R extends string> {
  roleConfig: Record<R, RoleConfig>;
  roleOrder: R[];
  defaults: () => Settings<R>;
  apply: (settings: Settings<R> | null) => void;
  load: (worldId: string) => Promise<Settings<R>>;
  save: (worldId: string, settings: Settings<R>) => Promise<void>;
  useTypography: (worldId: string | null) => {
    settings: Settings<R>;
    loaded: boolean;
    update: (next: Settings<R>) => void;
    reset: () => void;
  };
}

export function makeTypography<R extends string>(opts: {
  storePrefix: string;
  roleConfig: Record<R, RoleConfig>;
  roleOrder: R[];
  /** When true, the hook applies no CSS vars until the user explicitly
   *  overrides — so the system's tokens fall through to their cascade
   *  defaults. Reset wipes the store key and restores the cascade rather
   *  than applying hardcoded defaults. */
  inheritCascade?: boolean;
}): TypographyModule<R> {
  const { storePrefix, roleConfig, roleOrder, inheritCascade = false } = opts;

  function defaults(): Settings<R> {
    const out = {} as Settings<R>;
    for (const role of roleOrder) {
      out[role] = { family: roleConfig[role].defaultFamily, sizeRem: roleConfig[role].defaultSizeRem };
    }
    return out;
  }

  function apply(settings: Settings<R> | null): void {
    const root = document.documentElement;
    for (const role of roleOrder) {
      const cfg = roleConfig[role];
      if (settings) {
        root.style.setProperty(cfg.fontVar, FONT_STACKS[settings[role].family]);
        root.style.setProperty(cfg.sizeVar, `${settings[role].sizeRem}rem`);
      } else {
        root.style.removeProperty(cfg.fontVar);
        root.style.removeProperty(cfg.sizeVar);
      }
    }
  }

  function isValid(v: unknown): v is Settings<R> {
    if (!v || typeof v !== 'object') return false;
    const obj = v as Record<string, unknown>;
    return roleOrder.every((role) => {
      const r = obj[role] as { family?: unknown; sizeRem?: unknown } | undefined;
      return (
        r !== undefined &&
        typeof r === 'object' &&
        isFontKey(r.family) &&
        typeof r.sizeRem === 'number' &&
        r.sizeRem > 0 &&
        r.sizeRem < 6
      );
    });
  }

  const storeKey = (worldId: string) => `${storePrefix}:${worldId}`;

  /** Returns the stored settings, or null when nothing valid is saved. */
  async function loadStored(worldId: string): Promise<Settings<R> | null> {
    try {
      const store = await getSettingsStore();
      const raw = await store.get<unknown>(storeKey(worldId));
      if (isValid(raw)) return raw;
    } catch {
      /* fall through */
    }
    return null;
  }

  async function load(worldId: string): Promise<Settings<R>> {
    return (await loadStored(worldId)) ?? defaults();
  }

  async function save(worldId: string, settings: Settings<R>): Promise<void> {
    try {
      const store = await getSettingsStore();
      await store.set(storeKey(worldId), settings);
      await store.save();
    } catch (e) {
      console.error(`Failed to save ${storePrefix}:`, e);
    }
  }

  async function remove(worldId: string): Promise<void> {
    try {
      const store = await getSettingsStore();
      await store.delete(storeKey(worldId));
      await store.save();
    } catch (e) {
      console.error(`Failed to clear ${storePrefix}:`, e);
    }
  }

  function useTypography(worldId: string | null) {
    const [settings, setSettings] = useState<Settings<R>>(defaults);
    const [loaded, setLoaded] = useState(false);
    const saveTimerRef = useRef<number | null>(null);

    useEffect(() => {
      if (!worldId) {
        apply(null);
        setSettings(defaults());
        setLoaded(true);
        return;
      }
      let cancelled = false;
      setLoaded(false);
      loadStored(worldId).then((stored) => {
        if (cancelled) return;
        if (stored) {
          setSettings(stored);
          apply(stored);
        } else {
          // Nothing saved: show defaults in the UI, but only push them to the
          // DOM when this system doesn't inherit from a cascade.
          setSettings(defaults());
          apply(inheritCascade ? null : defaults());
        }
        setLoaded(true);
      });
      return () => {
        cancelled = true;
      };
    }, [worldId]);

    useEffect(() => {
      return () => {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [worldId]);

    const update = useCallback(
      (next: Settings<R>) => {
        setSettings(next);
        apply(next);
        if (!worldId) return;
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          save(worldId, next);
          saveTimerRef.current = null;
        }, 250);
      },
      [worldId],
    );

    const reset = useCallback(() => {
      if (inheritCascade) {
        // Restore the cascade: drop the vars and forget the saved override.
        if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
        setSettings(defaults());
        apply(null);
        if (worldId) void remove(worldId);
      } else {
        update(defaults());
      }
    }, [update, worldId]);

    return { settings, loaded, update, reset };
  }

  return { roleConfig, roleOrder, defaults, apply, load, save, useTypography };
}
