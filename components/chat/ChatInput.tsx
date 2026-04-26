"use client";

import { SendHorizontal } from "lucide-react";
import { FormEvent, KeyboardEvent } from "react";

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatInput({ value, disabled, onChange, onSubmit }: Props) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-black/5 bg-[#F6F6F6] p-3 shadow-lg">
      <button
        type="button"
        disabled
        className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-slate-400"
        aria-label="첨부"
      >
        +
      </button>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={disabled ? "답장을 기다리는 중..." : "메시지를 입력하세요"}
        className="max-h-28 min-h-10 flex-1 resize-none rounded-[20px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE500] text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
      >
        <SendHorizontal size={18} />
      </button>
    </form>
  );
}
