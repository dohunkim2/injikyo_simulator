"use client";

import Image from "next/image";
import { useState } from "react";

import { formatTime } from "@/lib/utils";
import type { Message } from "@/lib/types";

type Props = {
  message: Message;
  characterName: string;
  characterImage: string;
  showProfile?: boolean;
  showTime?: boolean;
};

export function ChatBubble({
  message,
  characterName,
  characterImage,
  showProfile = true,
  showTime = true,
}: Props) {
  const isMine = message.role === "user";
  const [imageSrc, setImageSrc] = useState(characterImage);

  return (
    <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
      {!isMine && showProfile ? (
        <Image
          src={imageSrc}
          alt={characterName}
          width={36}
          height={36}
          className="h-9 w-9 rounded-full bg-white/70 object-cover"
          onError={() => setImageSrc("/characters/default-avatar.svg")}
        />
      ) : !isMine ? (
        <div className="h-9 w-9" />
      ) : null}
      <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isMine && showProfile ? <span className="px-1 text-xs text-slate-600">{characterName}</span> : null}
        <div
          className={`px-4 py-3 text-sm leading-6 shadow-sm ${
            isMine
              ? "rounded-2xl rounded-tr-md bg-[#FEE500] text-slate-900"
              : "rounded-2xl rounded-tl-md bg-white text-slate-900"
          }`}
        >
          {message.content}
        </div>
        {showTime ? (
          <span className="px-1 text-[11px] text-slate-500">{formatTime(message.timestamp)}</span>
        ) : null}
      </div>
    </div>
  );
}
