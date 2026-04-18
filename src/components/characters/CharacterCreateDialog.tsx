import { useState, useRef, useEffect, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { commands } from '../../lib/commands';
import './CharacterCreateDialog.css';

const TAG_SUGGESTIONS: Record<string, string[]> = {
  Fantasy: ['warrior', 'mage', 'elf', 'orc', 'dragon', 'kingdom', 'tavern', 'guild', 'noble', 'healer', 'thief', 'ranger', 'paladin', 'necromancer', 'bard'],
  'Sci-Fi': ['pilot', 'engineer', 'android', 'alien', 'captain', 'scientist', 'hacker', 'cyborg', 'clone', 'navigator'],
  Historical: ['soldier', 'monarch', 'merchant', 'priest', 'explorer', 'scholar', 'artisan', 'diplomat'],
  Modern: ['detective', 'journalist', 'hacker', 'corporate', 'athlete', 'artist', 'politician'],
  Horror: ['survivor', 'hunter', 'occultist', 'detective', 'victim', 'cultist'],
};
const DEFAULT_SUGGESTIONS = ['protagonist', 'antagonist', 'ally', 'mentor', 'sidekick', 'rival'];

interface CharacterCreateDialogProps {
  worldType: string;
  onClose: () => void;
  onCreate: (characterId: string) => void;
}

export function CharacterCreateDialog({ worldType, onClose, onCreate }: CharacterCreateDialogProps) {
  const [name, setName] = useState('');
  const [shortRole, setShortRole] = useState('');
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const suggestions = useMemo(() => {
    return TAG_SUGGESTIONS[worldType] || DEFAULT_SUGGESTIONS;
  }, [worldType]);

  // Filter suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    const existingTags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const currentTag = tagsInput.split(',').pop()?.trim().toLowerCase() ?? '';
    return suggestions.filter(
      (s) => !existingTags.includes(s) && (!currentTag || s.includes(currentTag))
    );
  }, [tagsInput, suggestions]);

  async function handlePickImage() {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (selected) {
      try {
        const assetId = await commands.importAsset(selected);
        const asset = await commands.getAsset(assetId);
        setImageAssetId(assetId);
        setImagePreview(`data:${asset.mime_type};base64,${asset.data_base64}`);
      } catch (e) {
        console.error('Failed to import image:', e);
      }
    }
  }

  function addTagSuggestion(tag: string) {
    const lastCommaIndex = tagsInput.lastIndexOf(',');
    if (lastCommaIndex === -1) {
      setTagsInput(tag);
    } else {
      const before = tagsInput.substring(0, lastCommaIndex + 1);
      setTagsInput(`${before} ${tag}`);
    }
    setShowSuggestions(false);
    tagsRef.current?.focus();
  }

  function normalizeTags(raw: string): string {
    return raw
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9 \-_]/g, '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0 && t.length <= 50)
      .filter((t, i, arr) => arr.indexOf(t) === i) // dedupe
      .join(', ');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      const tags = normalizeTags(tagsInput) || undefined;

      const character = await commands.createCharacter({
        name: name.trim(),
        shortRole: shortRole.trim() || undefined,
        imageAssetId: imageAssetId ?? undefined,
        tagsText: tags,
      });
      onCreate(character.id);
    } catch (e) {
      console.error('Failed to create character:', e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div className="dialog character-create-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2 className="dialog__title">Create Character</h2>
        <form onSubmit={handleSubmit}>
          <div className="dialog__field">
            <label className="dialog__label">Name *</label>
            <input
              ref={nameRef}
              className="dialog__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
            />
          </div>

          <div className="dialog__field">
            <label className="dialog__label">Image</label>
            <div className="character-create-dialog__image-picker">
              {imagePreview ? (
                <div className="character-create-dialog__image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <button type="button" className="character-create-dialog__image-remove" onClick={() => { setImageAssetId(null); setImagePreview(null); }}>
                    &times;
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn--secondary" onClick={handlePickImage}>
                  Choose Image
                </button>
              )}
            </div>
          </div>

          <div className="dialog__field">
            <label className="dialog__label">Short Role</label>
            <input
              className="dialog__input"
              type="text"
              value={shortRole}
              onChange={(e) => setShortRole(e.target.value)}
              placeholder="e.g. Fleet Commander, Village Elder"
            />
          </div>

          <div className="dialog__field">
            <label className="dialog__label">Tags</label>
            <div className="character-create-dialog__tags-wrap">
              <input
                ref={tagsRef}
                className="dialog__input"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="warrior, noble, protagonist"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="character-create-dialog__suggestions">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="character-create-dialog__suggestion"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addTagSuggestion(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="dialog__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!name.trim() || submitting}
              style={{ background: 'var(--accent-characters)' }}
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
