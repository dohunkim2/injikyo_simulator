"use client";

import { FormEvent, useState } from "react";

import type { PlayerProfile } from "@/lib/types";

type Props = {
  profile: PlayerProfile;
  onSave: (nickname: string) => void;
};

export function PlayerProfileCard({ profile, onSave }: Props) {
  const [nickname, setNickname] = useState(profile.nickname);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(nickname);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="text-xs font-semibold text-slate-400">내 프로필</p>
      <div className="mt-3 flex gap-2">
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={16}
          className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#FEE500]"
          placeholder="랭킹에 표시될 닉네임"
        />
        <button className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          저장
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">게임 종료 시 이 닉네임으로 공용 랭킹에 기록됩니다.</p>
    </form>
  );
}
