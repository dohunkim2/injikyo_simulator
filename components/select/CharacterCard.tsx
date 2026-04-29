"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { Character } from "@/lib/types";

type Props = {
  character: Character;
  completed?: boolean;
  success?: boolean;
};

export function CharacterCard({ character, completed, success }: Props) {
  const [imageSrc, setImageSrc] = useState(character.profileImage);
  const objective = getObjectiveLabel(character);

  return (
    <Link
      href={`/chat/${character.id}`}
      className="group flex gap-4 rounded-3xl bg-white/90 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-slate-300"
    >
      <Image
        src={imageSrc}
        alt="블라인드 페르소나"
        width={96}
        height={96}
        className="h-24 w-24 rounded-2xl bg-slate-100 object-cover blur-sm saturate-75 ring-1 ring-black/5"
        onError={() => setImageSrc("/characters/default-avatar.svg")}
      />
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900 group-hover:text-slate-950">
              블라인드 페르소나
            </p>
            <p className="text-sm text-slate-500">목적: {objective}</p>
          </div>
          {completed ? (
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {success ? "성공" : "실패"}
            </span>
          ) : null}
        </div>

        <p className="text-sm leading-6 text-slate-700">
          {objective} 목적의 대화 훈련입니다. 상대가 누구인지는 대화에 들어가기 전까지 공개되지 않습니다.
        </p>

        <p className="text-xs leading-5 text-slate-500">키워드만 보고 전략을 세운 뒤 대화를 시작하세요.</p>
      </div>
    </Link>
  );
}

function getObjectiveLabel(character: Character) {
  if (character.id.startsWith("reconciliation")) return "화해";
  if (character.id.startsWith("persuasion")) return "설득";
  if (character.id.startsWith("love")) return "사랑";
  if (character.id.startsWith("refusal")) return "거절";
  return character.scoreLabel?.replace(" 점수", "") ?? "대화";
}
