"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { getDifficultyStars } from "@/lib/utils";
import type { Character } from "@/lib/types";

type Props = {
  character: Character;
  completed?: boolean;
  success?: boolean;
};

export function CharacterCard({ character, completed, success }: Props) {
  const [imageSrc, setImageSrc] = useState(character.profileImage);

  return (
    <Link
      href={`/chat/${character.id}`}
      className="flex gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <Image
        src={imageSrc}
        alt={character.name}
        width={96}
        height={96}
        className="h-24 w-24 rounded-2xl bg-slate-100 object-cover"
        onError={() => setImageSrc("/characters/default-avatar.svg")}
      />
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{character.name}</p>
            <p className="text-sm text-slate-500">{character.occupation}</p>
          </div>
          {completed ? (
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                success ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {success ? "💚 성공" : "💔 실패"}
            </span>
          ) : null}
        </div>

        <p className="text-sm leading-6 text-slate-700">{character.shortDescription}</p>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-1">
            난이도 {getDifficultyStars(character.difficulty)}
          </span>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
            미션: {character.mission}
          </span>
        </div>
      </div>
    </Link>
  );
}
