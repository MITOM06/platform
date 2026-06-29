'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders AI answer text as Markdown (parity with Flutter's MarkdownBody in
 * streaming_ai_bubble.dart). Used for finalized AI messages — bold, code,
 * lists, headings and links render properly instead of as raw `**` / `#` text.
 *
 * Links open in a new tab; styling is kept compact to sit inside a chat bubble.
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
            />
          ),
          p: ({ ...props }) => <p {...props} className="whitespace-pre-wrap" />,
          ul: ({ ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
          ol: ({ ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
          code: ({ ...props }) => (
            <code
              {...props}
              className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]"
            />
          ),
          pre: ({ ...props }) => (
            <pre
              {...props}
              className="overflow-x-auto rounded-lg bg-foreground/10 p-3 text-[0.85em] [&>code]:bg-transparent [&>code]:p-0"
            />
          ),
          h1: ({ ...props }) => <h1 {...props} className="text-base font-semibold" />,
          h2: ({ ...props }) => <h2 {...props} className="text-base font-semibold" />,
          h3: ({ ...props }) => <h3 {...props} className="text-sm font-semibold" />,
          blockquote: ({ ...props }) => (
            <blockquote {...props} className="border-l-2 border-border pl-3 italic opacity-90" />
          ),
          table: ({ ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} className="w-full border-collapse text-[0.85em]" />
            </div>
          ),
          th: ({ ...props }) => <th {...props} className="border border-border px-2 py-1 text-left font-semibold" />,
          td: ({ ...props }) => <td {...props} className="border border-border px-2 py-1" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
