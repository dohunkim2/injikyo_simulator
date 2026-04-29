"use client";

import Link from "next/link";

type Props = {
  open: boolean;
  success: boolean;
  characterId: string;
  onClose: () => void;
};

export function GameOverModal({ open, success, characterId, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        <h2 className="mt-4 text-2xl font-bold text-slate-900">
          {success ? "과제 성공!" : "이번엔 아쉽다"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {success
            ? "10턴 동안의 대화 전략이 목표 점수를 넘겼어요."
            : "10턴 대화가 끝났어요. 루브릭을 다시 보면 더 좋은 전략을 만들 수 있어요."}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            채팅 보기
          </button>
          <Link
            href={`/result/${characterId}`}
            className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
          >
            결과 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
