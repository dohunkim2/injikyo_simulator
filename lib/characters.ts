import rawCharacters from "@/config/characters.json";
import * as z from "zod";

import { GAME } from "./constants";
import type { Character, CharacterConfig } from "./types";

const ruleSchema = z.object({
  trigger: z.string().min(1),
  range: z.tuple([z.number().int(), z.number().int()]),
});

const evaluationRubricItemSchema = z.object({
  label: z.string().min(1),
  points: z.number().positive(),
  criteria: z.string().min(1),
});

export const characterConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  profileImage: z.string().min(1),
  age: z.number().int().positive(),
  occupation: z.string().min(1),
  shortDescription: z.string().min(1),
  personality: z.array(z.string().min(1)).min(1),
  speechStyle: z.string().min(1),
  situation: z.string().min(1),
  mission: z.string().min(1),
  openingLine: z.string().min(1).optional(),
  scoreLabel: z.string().min(1).optional(),
  theory: z.string().min(1).optional(),
  personaBrief: z.string().min(1).optional(),
  initialState: z.string().min(1).optional(),
  successCriteria: z.string().min(1).optional(),
  failureCriteria: z.string().min(1).optional(),
  evaluationRubric: z.array(evaluationRubricItemSchema).optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  model: z.string().min(1).optional(),
  startAffection: z.number().int().min(0).max(100).optional(),
  successThreshold: z.number().int().min(0).max(100).optional(),
  failThreshold: z.number().int().min(0).max(100).optional(),
  maxTurns: z.number().int().positive().optional(),
  likes: z.array(ruleSchema),
  dislikes: z.array(ruleSchema),
});

const parsedConfigs = z.array(characterConfigSchema).parse(rawCharacters) as CharacterConfig[];

export function normalizeCharacter(character: CharacterConfig): Character {
  return {
    ...character,
    model: character.model ?? GAME.CHAT_MODEL_FALLBACK,
    startAffection: character.startAffection ?? GAME.DEFAULT_START_AFFECTION,
    successThreshold: character.successThreshold ?? GAME.DEFAULT_SUCCESS_THRESHOLD,
    failThreshold: character.failThreshold ?? GAME.DEFAULT_FAIL_THRESHOLD,
    maxTurns: character.maxTurns ?? GAME.DEFAULT_MAX_TURNS,
  };
}

const characters: Character[] = parsedConfigs.map(normalizeCharacter);

export function getCharacters(): Character[] {
  return characters;
}

export function getCharacterById(id: string): Character | null {
  return characters.find((character) => character.id === id) ?? null;
}
