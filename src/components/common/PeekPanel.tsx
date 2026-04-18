import { useEffect, useState } from 'react';
import { commands } from '../../lib/commands';
import type {
  CharacterFull,
  LinkedRecordDisplay,
  LoreDocumentFull,
  MapEntityFull,
} from '../../lib/commands';
import { useAppStore, type PeekTarget } from '../../state/store';
import { TipTapEditor } from '../editor/TipTapEditor';
import { useImageCache } from '../../hooks/useImageCache';
import './PeekPanel.css';

const ENTITY_LABEL: Record<PeekTarget['entityType'], string> = {
  character: 'Character',
  map_entity: 'Location',
  lore_document: 'Lore Document',
};

/** Duration of the slide-out animation when the user clicks "Open Full".
 *  Matches the spec §14 "300ms" slide transition. The panel plays the
 *  animation, THEN we fire the navigation so the full-view paints over the
 *  empty space the panel left behind. */
const FULL_TRANSITION_MS = 300;

export function PeekPanel() {
  const peekTarget = useAppStore((s) => s.peekTarget);
  const setPeekTarget = useAppStore((s) => s.setPeekTarget);
  const openFullFromPeek = useAppStore((s) => s.openFullFromPeek);
  const [leaving, setLeaving] = useState(false);

  // Reset the leaving flag whenever a new peek target opens — otherwise a
  // rapid "Open Full → Back" sequence could land in a stale leaving state.
  useEffect(() => {
    if (peekTarget) setLeaving(false);
  }, [peekTarget]);

  // Escape closes the panel without dismissing on backdrop click.
  useEffect(() => {
    if (!peekTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPeekTarget(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peekTarget, setPeekTarget]);

  if (!peekTarget) return null;

  function handleOpenFull() {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      openFullFromPeek();
    }, FULL_TRANSITION_MS);
  }

  return (
    <aside
      className={`peek-panel ${leaving ? 'peek-panel--leaving' : ''}`}
      data-entity-type={peekTarget.entityType}
    >
      <header className="peek-panel__header">
        <span className="peek-panel__type-label">{ENTITY_LABEL[peekTarget.entityType]}</span>
        <div className="peek-panel__actions">
          <button
            type="button"
            className="btn btn--ghost peek-panel__open-full"
            onClick={handleOpenFull}
            disabled={leaving}
          >
            Open Full →
          </button>
          <button
            type="button"
            className="peek-panel__close"
            aria-label="Close peek panel"
            onClick={() => setPeekTarget(null)}
            disabled={leaving}
          >
            ×
          </button>
        </div>
      </header>
      <div className="peek-panel__body">
        {peekTarget.entityType === 'character' && (
          <PeekCharacter characterId={peekTarget.entityId} />
        )}
        {peekTarget.entityType === 'lore_document' && (
          <PeekLore documentId={peekTarget.entityId} />
        )}
        {peekTarget.entityType === 'map_entity' && (
          <PeekMapEntity entityId={peekTarget.entityId} />
        )}
      </div>
    </aside>
  );
}

// ─── Character ───────────────────────────────────────────────────────────────

function PeekCharacter({ characterId }: { characterId: string }) {
  const [character, setCharacter] = useState<CharacterFull | null>(null);
  const [links, setLinks] = useState<LinkedRecordDisplay[]>([]);
  const [missing, setMissing] = useState(false);
  const { getImageUrl, loadImages } = useImageCache();

  useEffect(() => {
    let cancelled = false;
    setCharacter(null);
    setLinks([]);
    setMissing(false);
    (async () => {
      try {
        const [char, ls] = await Promise.all([
          commands.getCharacter(characterId),
          commands.listEntityLinks('character', characterId),
        ]);
        if (cancelled) return;
        setCharacter(char);
        setLinks(ls);
        if (char.image_asset_id) loadImages([char.image_asset_id]);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [characterId, loadImages]);

  if (missing) return <PeekUnavailable />;
  if (!character) return <PeekLoading />;

  const imageUrl = getImageUrl(character.image_asset_id);
  const briefDetails = parseBriefDetails(character.brief_details_json);

  return (
    <div className="peek-character">
      {/* Picture slot is always rendered so the layout reads the same whether
          or not the character has a portrait. When there's no image we show a
          placeholder with the chess-piece glyph, matching the CharacterList
          empty-state. */}
      <div
        className={`peek-character__image ${imageUrl ? '' : 'peek-character__image--placeholder'}`}
        style={{
          borderColor: character.decorative_ribbon || 'var(--accent-characters)',
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={character.name} />
        ) : (
          <span className="peek-character__image-glyph">&#9823;</span>
        )}
      </div>
      <h2
        className="peek-character__name"
        style={{
          borderBottomColor: character.decorative_ribbon || 'var(--accent-characters)',
        }}
      >
        {character.name}
      </h2>
      {character.objective_summary && (
        <section className="peek-character__section">
          <h3 className="peek-character__section-title">Objective</h3>
          {/* `objective_summary` is stored as TipTap JSON — render with a
              non-editable editor instance so it comes through as rich text
              instead of raw JSON string. Mirrors PeekLore / PeekMapEntity. */}
          <TipTapEditor
            content={character.objective_summary}
            editable={false}
            onUpdate={() => {}}
            className="peek-character__tt"
          />
        </section>
      )}
      {character.in_character_intro && (
        <section className="peek-character__section">
          <h3 className="peek-character__section-title">Intro</h3>
          <blockquote className="peek-character__intro">
            <TipTapEditor
              content={character.in_character_intro}
              editable={false}
              onUpdate={() => {}}
              className="peek-character__tt"
            />
          </blockquote>
        </section>
      )}
      {briefDetails.length > 0 && (
        <section className="peek-character__section">
          <h3 className="peek-character__section-title">Brief Details</h3>
          <dl className="peek-character__details">
            {briefDetails.map(([k, v]) => (
              <div key={k} className="peek-character__detail-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <PeekLinkedSummary links={links} />
    </div>
  );
}

function parseBriefDetails(raw: string | null): Array<[string, string]> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((p) => p && typeof p === 'object')
        .map((p): [string, string] => [String(p.key ?? ''), String(p.value ?? '')])
        .filter(([k]) => k.length > 0);
    }
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(
        ([k, v]): [string, string] => [k, String(v ?? '')],
      );
    }
  } catch {
    /* ignore */
  }
  return [];
}

// ─── Lore document ───────────────────────────────────────────────────────────

function PeekLore({ documentId }: { documentId: string }) {
  const [doc, setDoc] = useState<LoreDocumentFull | null>(null);
  const [links, setLinks] = useState<LinkedRecordDisplay[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setLinks([]);
    setMissing(false);
    (async () => {
      try {
        const [d, ls] = await Promise.all([
          commands.getLoreDocument(documentId),
          commands.listEntityLinks('lore_document', documentId),
        ]);
        if (cancelled) return;
        setDoc(d);
        setLinks(ls);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (missing) return <PeekUnavailable />;
  if (!doc) return <PeekLoading />;

  return (
    <div className="peek-lore">
      <h2 className="peek-lore__title">{doc.title}</h2>
      <TipTapEditor
        content={doc.content}
        editable={false}
        onUpdate={() => {}}
        className="peek-lore__content"
      />
      <PeekLinkedSummary links={links} />
    </div>
  );
}

// ─── Map entity ──────────────────────────────────────────────────────────────

function PeekMapEntity({ entityId }: { entityId: string }) {
  const [entity, setEntity] = useState<MapEntityFull | null>(null);
  const [links, setLinks] = useState<LinkedRecordDisplay[]>([]);
  const [missing, setMissing] = useState(false);
  const { getImageUrl, loadImages } = useImageCache();

  useEffect(() => {
    let cancelled = false;
    setEntity(null);
    setLinks([]);
    setMissing(false);
    (async () => {
      try {
        const [ent, ls] = await Promise.all([
          commands.getMapEntity(entityId),
          commands.listEntityLinks('map_entity', entityId),
        ]);
        if (cancelled) return;
        setEntity(ent);
        setLinks(ls);
        if (ent.image_asset_id) loadImages([ent.image_asset_id]);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, loadImages]);

  if (missing) return <PeekUnavailable />;
  if (!entity) return <PeekLoading />;

  const imageUrl = getImageUrl(entity.image_asset_id);
  const tags = (entity.tags_text ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="peek-map-entity">
      <h2 className="peek-map-entity__title">{entity.title}</h2>
      <div className="peek-map-entity__type">{entity.entity_type}</div>
      {imageUrl && (
        <div className="peek-map-entity__image">
          <img src={imageUrl} alt={entity.title} />
        </div>
      )}
      {tags.length > 0 && (
        <div className="peek-map-entity__tags">
          {tags.map((t) => (
            <span key={t} className="peek-map-entity__tag">
              {t}
            </span>
          ))}
        </div>
      )}
      <TipTapEditor
        content={entity.description ?? ''}
        editable={false}
        onUpdate={() => {}}
        className="peek-map-entity__desc"
      />
      <PeekLinkedSummary links={links} />
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function PeekLinkedSummary({ links }: { links: LinkedRecordDisplay[] }) {
  const setPeekTarget = useAppStore((s) => s.setPeekTarget);
  if (links.length === 0) return null;

  return (
    <section className="peek-panel__linked">
      <h3 className="peek-panel__linked-title">Linked records</h3>
      <ul className="peek-panel__linked-list">
        {links.map((l) => (
          <li key={l.link_id}>
            <button
              type="button"
              className="peek-panel__linked-item"
              data-entity-type={l.entity_type}
              onClick={() =>
                setPeekTarget({
                  entityType: l.entity_type as PeekTarget['entityType'],
                  entityId: l.entity_id,
                })
              }
            >
              <span className="peek-panel__linked-name">{l.entity_name}</span>
              <span className="peek-panel__linked-type">{l.link_type}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PeekLoading() {
  return <div className="peek-panel__loading">Loading…</div>;
}

function PeekUnavailable() {
  return (
    <div className="peek-panel__unavailable">
      <p>Record unavailable.</p>
      <p className="peek-panel__unavailable-sub">It may have been moved to the recycle bin.</p>
    </div>
  );
}
