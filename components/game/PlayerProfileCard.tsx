"use client";

import { Check } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import type { PlayerProfile } from "@/lib/types";

type Props = {
  profile: PlayerProfile;
  onSave: (nickname: string) => void;
};

export function PlayerProfileCard({ profile, onSave }: Props) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setNickname(profile.nickname);
  }, [profile.nickname]);

  useEffect(() => {
    if (!justSaved) return;
    const id = window.setTimeout(() => setJustSaved(false), 1600);
    return () => window.clearTimeout(id);
  }, [justSaved]);

  const trimmed = nickname.trim();
  const isDirty = trimmed.length > 0 && trimmed !== profile.nickname;
  const isEmpty = trimmed.length === 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDirty || isEmpty) return;
    onSave(trimmed);
    setJustSaved(true);
  };

  const statusLabel = isEmpty
    ? "닉네임을 입력해 주세요"
    : isDirty
      ? "변경사항이 있습니다"
      : justSaved
        ? "방금 저장했습니다"
        : "저장됨";
  const statusClass = isEmpty
    ? "text-rose-600"
    : isDirty
      ? "text-amber-600"
      : "text-emerald-600";

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">내 프로필</p>
        <span className={`flex items-center gap-1 text-xs font-semibold ${statusClass}`}>
          {!isDirty && !isEmpty ? <Check size={14} className="stroke-[3]" /> : null}
          {statusLabel}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={16}
          className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none transition ${
            isDirty
              ? "border-amber-300 bg-amber-50 focus:border-amber-500"
              : "border-slate-200 focus:border-[#FEE500]"
          }`}
          placeholder="랭킹에 표시될 닉네임"
        />
        <button
          type="submit"
          disabled={!isDirty || isEmpty}
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isDirty ? "저장" : justSaved ? "저장됨" : "저장됨"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        현재 닉네임:{" "}
        <span className="font-semibold text-slate-700">{profile.nickname}</span> · 게임 종료 시 이 닉네임으로 공용
        랭킹에 기록됩니다.
      </p>
    </form>
  );
}
