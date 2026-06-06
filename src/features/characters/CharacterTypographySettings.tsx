// Character Codex typography popover. Now built on the shared TypographyDialog
// (Packet 10) so it shares the grouped font catalog with Lore.

import { TypographyDialog } from '../../components/typography/TypographyDialog';
import { ROLE_CONFIG, ROLE_ORDER, type TypographySettings } from '../../hooks/useCharacterTypography';

interface CharacterTypographySettingsProps {
  settings: TypographySettings;
  onChange: (next: TypographySettings) => void;
  onReset: () => void;
  onClose: () => void;
}

export function CharacterTypographySettings({
  settings,
  onChange,
  onReset,
  onClose,
}: CharacterTypographySettingsProps) {
  return (
    <TypographyDialog
      eyebrow="Typography"
      title="Codex Type"
      ariaLabel="Character typography settings"
      roleConfig={ROLE_CONFIG}
      roleOrder={ROLE_ORDER}
      settings={settings}
      onChange={onChange}
      onReset={onReset}
      onClose={onClose}
      accent={{ color: 'var(--accent-characters)', rgb: 'var(--accent-characters-rgb)' }}
      preview={
        <>
          <div
            className="type-preview__display"
            style={{ fontFamily: 'var(--char-font-heading)', fontSize: 'var(--char-size-heading)' }}
          >
            Aria Brightwood
          </div>
          <p className="type-preview__body" style={{ fontFamily: 'var(--char-font-prose)' }}>
            A wandering scribe with a memory for songs nobody else can recall.
          </p>
          <span className="type-preview__label" style={{ fontFamily: 'var(--char-font-key)' }}>
            Age 24 · The Hollow Coast
          </span>
        </>
      }
    />
  );
}
