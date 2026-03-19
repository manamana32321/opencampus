'use client';

interface TranscriptPreviewProps {
  /** HTML string produced by tiptap — always editor-generated, never raw user input */
  html: string;
}

export default function TranscriptPreview({ html }: TranscriptPreviewProps) {
  if (!html || html === '<p></p>') {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Preview will appear as you type…
      </div>
    );
  }

  return (
    // Content is always produced by tiptap's getHTML() — editor-controlled output, not raw user input.
    <div
      className="h-full overflow-y-auto px-5 py-4 text-sm leading-relaxed text-zinc-200 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-zinc-50 [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-400 [&_blockquote]:italic [&_blockquote]:my-2 [&_pre]:bg-zinc-950 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_code]:font-mono [&_code]:text-xs [&_code]:text-emerald-300 [&_:not(pre)>code]:bg-zinc-800 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_strong]:font-semibold [&_strong]:text-zinc-50 [&_em]:italic"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
