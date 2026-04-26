export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="h-9 w-9 rounded-full bg-white/70" />
      <div className="rounded-[16px] bg-white px-4 py-3 shadow-sm">
        <div className="flex gap-1">
          <span className="typing-dot" />
          <span className="typing-dot [animation-delay:0.15s]" />
          <span className="typing-dot [animation-delay:0.3s]" />
        </div>
      </div>
    </div>
  );
}
