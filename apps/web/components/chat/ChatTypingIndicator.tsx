'use client'

export function ChatTypingIndicator() {
  return (
    <div className="flex items-center justify-start ml-2 mb-2 mt-1">
      <div className="bg-card/40 border border-border/15 backdrop-blur-sm px-3.5 py-2.5 rounded-2xl flex items-center gap-2 max-w-fit shadow-sm">
        <span className="text-xs font-medium text-foreground/50">Đang nhập</span>
        <div className="flex space-x-1 items-center h-4">
          <div className="w-1.5 h-1.5 bg-pon-cyan rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1.5 h-1.5 bg-pon-cyan rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1.5 h-1.5 bg-pon-cyan rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  )
}
