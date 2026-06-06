// Packet 10 §4.1 — Lore typography gear popover.

import { TypographyDialog } from '../../components/typography/TypographyDialog';
import {
  LORE_ROLE_CONFIG,
  LORE_ROLE_ORDER,
  type LoreTypographySettings as Settings,
} from '../../hooks/useLoreTypography';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  onReset: () => void;
  onClose: () => void;
}

export function LoreTypographySettings({ settings, onChange, onReset, onClose }: Props) {
  return (
    <TypographyDialog
      eyebrow="Typography"
      title="Lore Type"
      ariaLabel="Lore typography settings"
      roleConfig={LORE_ROLE_CONFIG}
      roleOrder={LORE_ROLE_ORDER}
      settings={settings}
      onChange={onChange}
      onReset={onReset}
      onClose={onClose}
      preview={
        <>
          <h3 className="type-preview__display" style={{ fontFamily: 'var(--lore-font-display)' }}>
            The Hollow Coast
          </h3>
          <p className="type-preview__body" style={{ fontFamily: 'var(--lore-font-body)' }}>
            The tide pulled back further than living memory recorded, and what it left behind was
            not sand but doors.
          </p>
          <blockquote className="type-preview__quote" style={{ fontFamily: 'var(--lore-font-quote)' }}>
            "We do not open them. We only count them."
          </blockquote>
          <span className="type-preview__label" style={{ fontFamily: 'var(--lore-font-label)' }}>
            Archive · Coastal Records
          </span>
        </>
      }
    />
  );
}
