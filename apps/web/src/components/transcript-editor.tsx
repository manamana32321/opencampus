'use client';

import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface TranscriptEditorProps {
  content: string;
  onChange: (html: string) => void;
  readonly?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={[
        'inline-flex items-center justify-center w-7 h-7 rounded text-sm transition-colors',
        active
          ? 'bg-zinc-600 text-white'
          : 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100',
        disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-zinc-700 mx-0.5" />;
}

export default function TranscriptEditor({
  content,
  onChange,
  readonly = false,
}: TranscriptEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Transcript will appear here after processing...',
      }),
    ],
    content: content || '',
    editable: !readonly,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Sync content when the prop changes externally (e.g. after fetch)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current) {
      editor.commands.setContent(content || '', { emitUpdate: false });
    }
  }, [content, editor]);

  // Sync editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readonly);
  }, [readonly, editor]);

  const editorState = useEditorState({
    editor,
    selector: (snapshot) => {
      const e = snapshot.editor;
      if (!e) {
        return {
          isBold: false,
          isItalic: false,
          isH1: false,
          isH2: false,
          isBulletList: false,
          isOrderedList: false,
          isCodeBlock: false,
          isBlockquote: false,
          canUndo: false,
          canRedo: false,
        };
      }
      return {
        isBold: e.isActive('bold'),
        isItalic: e.isActive('italic'),
        isH1: e.isActive('heading', { level: 1 }),
        isH2: e.isActive('heading', { level: 2 }),
        isBulletList: e.isActive('bulletList'),
        isOrderedList: e.isActive('orderedList'),
        isCodeBlock: e.isActive('codeBlock'),
        isBlockquote: e.isActive('blockquote'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Toolbar */}
      {!readonly && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-zinc-800 bg-zinc-800 flex-wrap">
          <ToolbarButton
            title="Bold (Ctrl+B)"
            active={editorState?.isBold}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <span className="font-bold text-xs">B</span>
          </ToolbarButton>
          <ToolbarButton
            title="Italic (Ctrl+I)"
            active={editorState?.isItalic}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <span className="italic text-xs">I</span>
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            title="Heading 1"
            active={editorState?.isH1}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <span className="text-xs font-semibold">H1</span>
          </ToolbarButton>
          <ToolbarButton
            title="Heading 2"
            active={editorState?.isH2}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <span className="text-xs font-semibold">H2</span>
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            title="Bullet List"
            active={editorState?.isBulletList}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            {/* bullet list icon */}
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="2" cy="4" r="1.5" />
              <rect x="5" y="3" width="9" height="2" rx="1" />
              <circle cx="2" cy="8" r="1.5" />
              <rect x="5" y="7" width="9" height="2" rx="1" />
              <circle cx="2" cy="12" r="1.5" />
              <rect x="5" y="11" width="9" height="2" rx="1" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            title="Ordered List"
            active={editorState?.isOrderedList}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            {/* ordered list icon */}
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <text x="0" y="5" fontSize="5" fontFamily="monospace">1.</text>
              <rect x="5" y="3" width="9" height="2" rx="1" />
              <text x="0" y="9" fontSize="5" fontFamily="monospace">2.</text>
              <rect x="5" y="7" width="9" height="2" rx="1" />
              <text x="0" y="13" fontSize="5" fontFamily="monospace">3.</text>
              <rect x="5" y="11" width="9" height="2" rx="1" />
            </svg>
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            title="Code Block"
            active={editorState?.isCodeBlock}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l-3 4 3 4M11 4l3 4-3 4" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            title="Blockquote"
            active={editorState?.isBlockquote}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 4h2v4H2zM7 4h2v4H7z" opacity="0.4" />
              <path d="M4 8c0 1.1-.9 2-2 2v1a3 3 0 003-3V4H4v4zM9 8c0 1.1-.9 2-2 2v1a3 3 0 003-3V4H9v4z" />
            </svg>
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            title="Undo (Ctrl+Z)"
            disabled={!editorState?.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6h7a4 4 0 010 8H5M2 6l3-3M2 6l3 3" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            title="Redo (Ctrl+Y)"
            disabled={!editorState?.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 6H7a4 4 0 000 8h4M14 6l-3-3M14 6l-3 3" />
            </svg>
          </ToolbarButton>
        </div>
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto [&_.tiptap]:min-h-full [&_.tiptap]:px-5 [&_.tiptap]:py-4 [&_.tiptap]:text-zinc-100 [&_.tiptap]:text-sm [&_.tiptap]:leading-relaxed [&_.tiptap]:outline-none [&_.tiptap_h1]:text-xl [&_.tiptap_h1]:font-semibold [&_.tiptap_h1]:text-zinc-50 [&_.tiptap_h1]:mt-4 [&_.tiptap_h1]:mb-2 [&_.tiptap_h2]:text-lg [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:text-zinc-100 [&_.tiptap_h2]:mt-3 [&_.tiptap_h2]:mb-1.5 [&_.tiptap_p]:mb-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ul]:mb-2 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ol]:mb-2 [&_.tiptap_li]:mb-0.5 [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-zinc-600 [&_.tiptap_blockquote]:pl-4 [&_.tiptap_blockquote]:text-zinc-400 [&_.tiptap_blockquote]:italic [&_.tiptap_blockquote]:my-2 [&_.tiptap_pre]:bg-zinc-950 [&_.tiptap_pre]:rounded-md [&_.tiptap_pre]:p-3 [&_.tiptap_pre]:my-2 [&_.tiptap_pre]:overflow-x-auto [&_.tiptap_code]:font-mono [&_.tiptap_code]:text-xs [&_.tiptap_code]:text-emerald-300 [&_.tiptap_:not(pre)>code]:bg-zinc-800 [&_.tiptap_:not(pre)>code]:px-1 [&_.tiptap_:not(pre)>code]:py-0.5 [&_.tiptap_:not(pre)>code]:rounded [&_.tiptap_strong]:font-semibold [&_.tiptap_strong]:text-zinc-50 [&_.tiptap_em]:italic [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:text-zinc-600 [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  );
}
