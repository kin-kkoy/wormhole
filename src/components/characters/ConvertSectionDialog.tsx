import { useEffect, useMemo, useRef, useState } from 'react';
import type { DetailSection } from '../../lib/commands';
import {
  convertSection,
  LAYOUT_LABELS,
  type ConversionResult,
  type LayoutType,
} from '../../lib/section-conversion';
import './ConvertSectionDialog.css';

const LAYOUTS: LayoutType[] = ['prose', 'cards', 'timeline', 'grid'];

interface ConvertSectionDialogProps {
  section: DetailSection;
  onClose: () => void;
  onConvert: (to: LayoutType, result: ConversionResult) => void;
}

export function ConvertSectionDialog({ section, onClose, onConvert }: ConvertSectionDialogProps) {
  const from = section.layout_type as LayoutType;
  const otherLayouts = LAYOUTS.filter((l) => l !== from);
  const [target, setTarget] = useState<LayoutType>(otherLayouts[0]);
  const [copied, setCopied] = useState(false);
  const dumpRef = useRef<HTMLTextAreaElement>(null);

  const result: ConversionResult = useMemo(
    () => convertSection(from, target, section.content, section.structured_content_json),
    [from, target, section.content, section.structured_content_json],
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    setCopied(false);
  }, [target]);

  async function handleCopy() {
    if (!result.dump) return;
    try {
      await navigator.clipboard.writeText(result.dump);
      setCopied(true);
    } catch {
      // Fallback: select text for manual copy.
      dumpRef.current?.select();
    }
  }

  function handleConfirm() {
    onConvert(target, result);
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        className="dialog convert-section-dialog"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="dialog__title">
          Convert &ldquo;{section.title}&rdquo; from {LAYOUT_LABELS[from]} to…
        </h2>

        <div className="convert-section-dialog__targets">
          {otherLayouts.map((lt) => {
            const isSelected = lt === target;
            return (
              <button
                key={lt}
                type="button"
                className={`convert-section-dialog__target ${
                  isSelected ? 'convert-section-dialog__target--selected' : ''
                }`}
                onClick={() => setTarget(lt)}
                aria-pressed={isSelected}
              >
                <span className="convert-section-dialog__target-label">{LAYOUT_LABELS[lt]}</span>
                {isSelected && (
                  <span className="convert-section-dialog__target-check" aria-hidden="true">
                    &#10003;
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p
          className={`convert-section-dialog__summary ${
            result.lossy ? 'convert-section-dialog__summary--lossy' : ''
          }`}
        >
          {result.summary}
        </p>

        {result.dump && (
          <div className="convert-section-dialog__dump">
            <div className="convert-section-dialog__dump-header">
              <span className="convert-section-dialog__dump-label">
                Content that will be dropped
              </span>
              <button
                type="button"
                className="btn btn--ghost convert-section-dialog__dump-copy"
                onClick={handleCopy}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              ref={dumpRef}
              className="convert-section-dialog__dump-text"
              value={result.dump}
              readOnly
              rows={6}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}

        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary convert-section-dialog__confirm"
            onClick={handleConfirm}
          >
            Convert
          </button>
        </div>
      </div>
    </div>
  );
}
