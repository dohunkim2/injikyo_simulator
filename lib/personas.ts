import { getCharacterById, getCharacters, normalizeCharacter } from "./characters";
import {
  getPersonaConfigOverride,
  getPersonaConfigOverrides,
  isDatabaseConfigured,
} from "./db";
import type { Character, CharacterConfig } from "./types";

function mergeCharacter(base: Character, override?: CharacterConfig): Character {
  return normalizeCharacter({
    ...base,
    ...override,
    id: base.id,
  });
}

export async function getPersonas(): Promise<Character[]> {
  const defaults = getCharacters();

  if (!isDatabaseConfigured()) {
    return defaults;
  }

  try {
    const overrides = await getPersonaConfigOverrides();
    const overrideById = new Map(overrides.map((item) => [item.characterId, item.config]));

    return defaults.map((character) => mergeCharacter(character, overrideById.get(character.id)));
  } catch {
    return defaults;
  }
}

export async function getPersonaById(characterId: string): Promise<Character | null> {
  const base = getCharacterById(characterId);

  if (!base) {
    return null;
  }

  if (!isDatabaseConfigured()) {
    return base;
  }

  try {
    const override = await getPersonaConfigOverride(characterId);
    return mergeCharacter(base, override?.config);
  } catch {
    return base;
  }
}
