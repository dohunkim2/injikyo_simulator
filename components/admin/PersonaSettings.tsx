"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { AffectionRule, Character, CharacterConfig, EvaluationRubricItem } from "@/lib/types";

type PersonasResponse = {
  personas: Character[];
};

type AvatarOptionsResponse = {
  options: string[];
};

function toConfig(persona: Character): CharacterConfig {
  return {
    id: persona.id,
    name: persona.name,
    profileImage: persona.profileImage,
    age: persona.age,
    occupation: persona.occupation,
    shortDescription: persona.shortDescription,
    personality: persona.personality,
    speechStyle: persona.speechStyle,
    situation: persona.situation,
    mission: persona.mission,
    openingLine: persona.openingLine,
    scoreLabel: persona.scoreLabel,
    theory: persona.theory,
    personaBrief: persona.personaBrief,
    initialState: persona.initialState,
    successCriteria: persona.successCriteria,
    failureCriteria: persona.failureCriteria,
    evaluationRubric: persona.evaluationRubric,
    difficulty: persona.difficulty,
    model: persona.model,
    startAffection: persona.startAffection,
    successThreshold: persona.successThreshold,
    failThreshold: persona.failThreshold,
    maxTurns: persona.maxTurns,
    likes: persona.likes,
    dislikes: persona.dislikes,
  };
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function PersonaSettings() {
  const [personas, setPersonas] = useState<Character[]>([]);
  const [avatarOptions, setAvatarOptions] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<CharacterConfig | null>(null);
  const [likes, setLikes] = useState<AffectionRule[]>([]);
  const [dislikes, setDislikes] = useState<AffectionRule[]>([]);
  const [rubric, setRubric] = useState<EvaluationRubricItem[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [personasResponse, avatarsResponse] = await Promise.all([
        fetch("/api/admin/personas", { cache: "no-store" }),
        fetch("/api/admin/avatar-options", { cache: "no-store" }),
      ]);

      if (personasResponse.status === 401 || avatarsResponse.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      const personasPayload = (await personasResponse.json()) as PersonasResponse;
      const avatarsPayload = (await avatarsResponse.json()) as AvatarOptionsResponse;

      setPersonas(personasPayload.personas);
      setAvatarOptions(avatarsPayload.options);
      setSelectedId((current) => current ?? personasPayload.personas[0]?.id ?? null);
    };

    void load();
  }, []);

  useEffect(() => {
    const selected = personas.find((persona) => persona.id === selectedId);
    if (!selected) return;

    const nextForm = toConfig(selected);
    setForm(nextForm);
    setLikes(nextForm.likes);
    setDislikes(nextForm.dislikes);
    setRubric(nextForm.evaluationRubric ?? []);
    setMessage("");
  }, [personas, selectedId]);

  const update = <K extends keyof CharacterConfig>(key: K, value: CharacterConfig[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!form) return;

    setSaving(true);
    setMessage("");

    try {
      const payload: CharacterConfig = {
        ...form,
        personality: parseLines(form.personality.join("\n")),
        likes,
        dislikes,
        evaluationRubric: rubric,
      };

      const response = await fetch(`/api/admin/personas/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as { persona?: Character; error?: string } | null;

      if (!response.ok || !result?.persona) {
        throw new Error(result?.error ?? "페르소나 저장에 실패했습니다.");
      }

      setPersonas((current) =>
        current.map((persona) => (persona.id === result.persona?.id ? result.persona : persona)),
      );
      setMessage("저장되었습니다. 새 세션부터 반영됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "페르소나 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm text-slate-500">페르소나 설정을 불러오는 중입니다.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">페르소나 설정</h2>
        <div className="mt-4 space-y-2">
          {personas.map((persona) => (
            <button
              key={persona.id}
              onClick={() => setSelectedId(persona.id)}
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm ring-1 ${
                selectedId === persona.id
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-slate-50 ring-transparent"
              }`}
            >
              <p className="font-semibold">{persona.name}</p>
              <p className="mt-1 text-xs opacity-70">{persona.mission}</p>
            </button>
          ))}
        </div>
      </aside>

      <div className="space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Settings</p>
            <h2 className="mt-1 text-2xl font-bold">{form.name}</h2>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>

        {message ? <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="이름" value={form.name} onChange={(value) => update("name", value)} />
          <Field label="직업/역할" value={form.occupation} onChange={(value) => update("occupation", value)} />
          <Field label="점수 라벨" value={form.scoreLabel ?? ""} onChange={(value) => update("scoreLabel", value)} />
          <Field
            label="첫 대사"
            value={form.openingLine ?? ""}
            onChange={(value) => update("openingLine", value)}
          />
        </div>

        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="font-semibold">프리셋 프사</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {avatarOptions.map((option) => (
              <button
                key={option}
                onClick={() => update("profileImage", option)}
                className={`rounded-2xl p-2 ring-2 ${
                  form.profileImage === option ? "ring-slate-900" : "ring-transparent"
                }`}
              >
                <Image src={option} alt={option} width={64} height={64} className="h-16 w-16 rounded-xl bg-white object-cover" />
              </button>
            ))}
          </div>
        </div>

        <Textarea label="짧은 설명" value={form.shortDescription} onChange={(value) => update("shortDescription", value)} />
        <Textarea label="상황" value={form.situation} onChange={(value) => update("situation", value)} />
        <Textarea label="과제/미션" value={form.mission} onChange={(value) => update("mission", value)} />
        <Textarea label="말투" value={form.speechStyle} onChange={(value) => update("speechStyle", value)} />
        <Textarea label="페르소나 해석" value={form.personaBrief ?? ""} onChange={(value) => update("personaBrief", value)} />
        <Textarea label="초기 상태" value={form.initialState ?? ""} onChange={(value) => update("initialState", value)} />
        <Textarea label="성공 기준" value={form.successCriteria ?? ""} onChange={(value) => update("successCriteria", value)} />
        <Textarea label="실패 기준" value={form.failureCriteria ?? ""} onChange={(value) => update("failureCriteria", value)} />
        <Textarea
          label="성격 키워드 (줄바꿈으로 구분)"
          value={form.personality.join("\n")}
          onChange={(value) => update("personality", parseLines(value))}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <NumberField label="시작 점수" value={form.startAffection ?? 40} onChange={(value) => update("startAffection", value)} />
          <NumberField label="성공 임계값" value={form.successThreshold ?? 80} onChange={(value) => update("successThreshold", value)} />
          <NumberField label="실패 임계값" value={form.failThreshold ?? 20} onChange={(value) => update("failThreshold", value)} />
          <NumberField label="최대 턴" value={form.maxTurns ?? 10} onChange={(value) => update("maxTurns", value)} />
        </div>

        <RuleEditor
          title="점수를 올리는 요소"
          description="사용자가 이런 행동을 하면 해당 범위만큼 점수가 오릅니다."
          rules={likes}
          tone="positive"
          onChange={setLikes}
        />
        <RuleEditor
          title="점수를 내리는 요소"
          description="레드플래그나 실수에 해당하는 행동입니다. 범위는 음수로 둡니다."
          rules={dislikes}
          tone="negative"
          onChange={setDislikes}
        />
        <RubricEditor rubric={rubric} onChange={setRubric} />
      </div>
    </section>
  );
}

function RuleEditor({
  title,
  description,
  rules,
  tone,
  onChange,
}: {
  title: string;
  description: string;
  rules: AffectionRule[];
  tone: "positive" | "negative";
  onChange: (rules: AffectionRule[]) => void;
}) {
  const fallbackRange: [number, number] = tone === "positive" ? [6, 12] : [-18, -10];

  const updateRule = (index: number, next: AffectionRule) => {
    onChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? next : rule)));
  };

  return (
    <section className="rounded-3xl bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...rules, { trigger: "새 기준", range: fallbackRange }])}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
        >
          항목 추가
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {rules.map((rule, index) => (
          <div key={`${rule.trigger}-${index}`} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
            <div className="grid gap-3 md:grid-cols-[1fr_100px_100px_auto]">
              <Field
                label="행동 기준"
                value={rule.trigger}
                onChange={(value) => updateRule(index, { ...rule, trigger: value })}
              />
              <NumberField
                label="최소"
                value={rule.range[0]}
                onChange={(value) => updateRule(index, { ...rule, range: [value, rule.range[1]] })}
              />
              <NumberField
                label="최대"
                value={rule.range[1]}
                onChange={(value) => updateRule(index, { ...rule, range: [rule.range[0], value] })}
              />
              <button
                type="button"
                onClick={() => onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))}
                className="self-end rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RubricEditor({
  rubric,
  onChange,
}: {
  rubric: EvaluationRubricItem[];
  onChange: (rubric: EvaluationRubricItem[]) => void;
}) {
  const updateItem = (index: number, next: EvaluationRubricItem) => {
    onChange(rubric.map((item, itemIndex) => (itemIndex === index ? next : item)));
  };

  return (
    <section className="rounded-3xl bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">채점 루브릭</p>
          <p className="mt-1 text-sm text-slate-500">최종 평가 기준입니다. 항목명, 배점, 세부 기준을 나눠 입력합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...rubric, { label: "새 평가 요소", points: 1, criteria: "세부 기준" }])}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
        >
          항목 추가
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {rubric.map((item, index) => (
          <div key={`${item.label}-${index}`} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
            <div className="grid gap-3 md:grid-cols-[1fr_100px_auto]">
              <Field
                label="평가 요소"
                value={item.label}
                onChange={(value) => updateItem(index, { ...item, label: value })}
              />
              <NumberField
                label="배점"
                value={item.points}
                onChange={(value) => updateItem(index, { ...item, points: value })}
              />
              <button
                type="button"
                onClick={() => onChange(rubric.filter((_, itemIndex) => itemIndex !== index))}
                className="self-end rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
              >
                삭제
              </button>
            </div>
            <Textarea
              label="세부 기준"
              value={item.criteria}
              rows={2}
              onChange={(value) => updateItem(index, { ...item, criteria: value })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-slate-900"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-normal outline-none focus:border-slate-900"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  rows = 4,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm font-normal outline-none focus:border-slate-900"
      />
    </label>
  );
}
