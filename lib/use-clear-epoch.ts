"use client";

import { useEffect } from "react";

import { storage } from "./storage";

export function useClearEpochCheck() {
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json()) as { lastClearedAt: string | null };
        if (cancelled || !payload.lastClearedAt) return;

        const local = storage.getClearEpoch();

        if (!local) {
          storage.setClearEpoch(payload.lastClearedAt);
          return;
        }

        if (new Date(payload.lastClearedAt).getTime() > new Date(local).getTime()) {
          storage.reset();
          storage.setClearEpoch(payload.lastClearedAt);
          window.location.reload();
        }
      } catch {
        // 네트워크 오류 시엔 동작하지 않음
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, []);
}
