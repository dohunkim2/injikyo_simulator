"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "관리자 로그인에 실패했습니다.");
      }

      router.replace("/admin");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "관리자 로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="mt-2 text-2xl font-bold">관리자 로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          플레이어 세션과 대화 기록은 관리자만 확인할 수 있습니다.
        </p>

        <label className="mt-6 block text-sm font-semibold text-slate-700" htmlFor="admin-password">
          관리자 비밀번호
        </label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-900"
          placeholder="ADMIN_PASSWORD"
          autoComplete="current-password"
        />

        {error ? <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "확인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}
