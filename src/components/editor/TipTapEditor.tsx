import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useCallback } from 'react';
import { InlineLinkNode } from './InlineLinkExtension';
import './TipTapEditor.css';

interface TipTapEditorProps {
  content: string;
  onUpdate: (json: string) => void;
  editable: boolean;
  placeholder?: string;
  className?: string;
}

export function TipTapEditor({
  content,
  onUpdate,
  editable,
  placeholder,
  className = '',
}: TipTapEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const debouncedUpdate = useCallback((json: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateRef.current(json);
    }, 300);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      InlineLinkNode,
      ...(placeholder
        ? [Placeholder.configure({ placeholder })]
        : []),
    ],
    content: parseContent(content),
    editable,
    onUpdate: ({ editor }) => {
      debouncedUpdate(JSON.stringify(editor.getJSON()));
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync content from outside (e.g. switching characters)
  useEffect(() => {
    if (!editor) return;
    const parsed = parseContent(content);
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(parsed);
    if (current !== incoming) {
      editor.commands.setContent(parsed);
    }
  }, [content, editor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className={`tiptap-editor ${editable ? 'tiptap-editor--editable' : ''} ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
}

function parseContent(content: string): Record<string, unknown> | string {
  if (!content || content === '{}') {
    return '';
  }
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}
