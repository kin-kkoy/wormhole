import { useState, useCallback, useMemo } from 'react';
import type { DetailSection } from '../../../lib/commands';
import './CardsSection.css';

interface CardEntry {
  id: string;
  title: string;
  subtitle: string;
  description: string;
}

interface CardsSectionProps {
  section: DetailSection;
  editMode: boolean;
  onUpdate: (sectionId: string, updates: { structuredContentJson?: string }) => void;
}

export function CardsSection({ section, editMode, onUpdate }: CardsSectionProps) {
  const cards: CardEntry[] = useMemo(() => {
    if (!section.structured_content_json) return [];
    try {
      return JSON.parse(section.structured_content_json);
    } catch {
      return [];
    }
  }, [section.structured_content_json]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const saveCards = useCallback((updated: CardEntry[]) => {
    onUpdate(section.id, { structuredContentJson: JSON.stringify(updated) });
  }, [section.id, onUpdate]);

  const addCard = useCallback(() => {
    const newCard: CardEntry = {
      id: crypto.randomUUID(),
      title: 'New Card',
      subtitle: '',
      description: '',
    };
    saveCards([...cards, newCard]);
    setEditingId(newCard.id);
  }, [cards, saveCards]);

  const updateCard = useCallback((cardId: string, field: keyof CardEntry, value: string) => {
    const updated = cards.map((c) => c.id === cardId ? { ...c, [field]: value } : c);
    saveCards(updated);
  }, [cards, saveCards]);

  const removeCard = useCallback((cardId: string) => {
    saveCards(cards.filter((c) => c.id !== cardId));
  }, [cards, saveCards]);

  return (
    <div className="cards-section">
      <div className="cards-section__grid">
        {cards.map((card) => (
          <div key={card.id} className="cards-section__card">
            {editMode && editingId === card.id ? (
              <div className="cards-section__card-edit">
                <input
                  className="cards-section__input"
                  value={card.title}
                  onChange={(e) => updateCard(card.id, 'title', e.target.value)}
                  placeholder="Title"
                  autoFocus
                />
                <input
                  className="cards-section__input cards-section__input--sm"
                  value={card.subtitle}
                  onChange={(e) => updateCard(card.id, 'subtitle', e.target.value)}
                  placeholder="Subtitle (e.g. Ally - Reluctant)"
                />
                <textarea
                  className="cards-section__textarea"
                  value={card.description}
                  onChange={(e) => updateCard(card.id, 'description', e.target.value)}
                  placeholder="Description..."
                  rows={3}
                />
                <div className="cards-section__card-actions">
                  <button className="btn btn--ghost" onClick={() => setEditingId(null)}>Done</button>
                  <button className="btn btn--ghost cards-section__delete-btn" onClick={() => removeCard(card.id)}>Delete</button>
                </div>
              </div>
            ) : (
              <div
                className="cards-section__card-view"
                onClick={editMode ? () => setEditingId(card.id) : undefined}
              >
                <h4 className="cards-section__card-title">{card.title}</h4>
                {card.subtitle && <span className="cards-section__card-subtitle">{card.subtitle}</span>}
                {card.description && <p className="cards-section__card-desc">{card.description}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
      {editMode && (
        <button className="cards-section__add" onClick={addCard}>
          + Add Card
        </button>
      )}
    </div>
  );
}
