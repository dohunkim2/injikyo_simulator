import { STORAGE_KEY } from "./constants";
import { getCharacterById, getCharacters } from "./characters";
import type {
  AllConversationsPayload,
  CharacterFeedback,
  ChatState,
  PlayerProfile,
  SavedData,
  SessionSaveStatus,
  StyleAnalysis,
} from "./types";

function createEmptyData(): SavedData {
  return {
    characters: {},
    createdAt: Date.now(),
  };
}

export const storage = {
  load(): SavedData | null {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createEmptyData();
      const parsed = JSON.parse(raw) as SavedData;
      return {
        createdAt: parsed.createdAt ?? Date.now(),
        playerProfile: parsed.playerProfile,
        characters: parsed.characters ?? {},
        analysis: parsed.analysis,
      };
    } catch {
      return createEmptyData();
    }
  },

  save(data: SavedData): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  saveChatState(characterId: string, state: ChatState): void {
    const data = this.load() ?? createEmptyData();
    data.characters[characterId] = {
      ...data.characters[characterId],
      chatState: state,
      completedAt: state.isGameOver ? Date.now() : data.characters[characterId]?.completedAt,
    };
    this.save(data);
  },

  saveFeedback(characterId: string, feedback: CharacterFeedback): void {
    const data = this.load() ?? createEmptyData();
    data.characters[characterId] = {
      ...data.characters[characterId],
      feedback,
      completedAt: Date.now(),
    };
    this.save(data);
  },

  getOrCreatePlayerProfile(): PlayerProfile {
    const data = this.load() ?? createEmptyData();

    if (data.playerProfile) {
      return data.playerProfile;
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const playerProfile: PlayerProfile = {
      playerId:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `player-${Date.now()}-${randomSuffix}`,
      nickname: `익명${randomSuffix}`,
      createdAt: Date.now(),
    };

    data.playerProfile = playerProfile;
    this.save(data);
    return playerProfile;
  },

  updateNickname(nickname: string): PlayerProfile {
    const data = this.load() ?? createEmptyData();
    const current = data.playerProfile ?? this.getOrCreatePlayerProfile();
    const nextProfile = {
      ...current,
      nickname: nickname.trim().slice(0, 16) || current.nickname,
    };

    data.playerProfile = nextProfile;
    this.save(data);
    return nextProfile;
  },

  saveServerSync(characterId: string, serverSync: SessionSaveStatus): void {
    const data = this.load() ?? createEmptyData();
    data.characters[characterId] = {
      ...data.characters[characterId],
      serverSync,
    };
    this.save(data);
  },

  saveAnalysis(analysis: StyleAnalysis): void {
    const data = this.load() ?? createEmptyData();
    data.analysis = analysis;
    this.save(data);
  },

  isAllCompleted(characterIds: string[]): boolean {
    const data = this.load();
    if (!data) return false;
    return characterIds.every((id) => Boolean(data.characters[id]?.chatState?.isGameOver));
  },

  getAllConversations(): AllConversationsPayload {
    const data = this.load() ?? createEmptyData();

    const allConversations = Object.entries(data.characters)
      .map(([characterId, record]) => {
        const character = getCharacterById(characterId);
        if (!character || !record.chatState?.isGameOver) return null;

        return {
          characterId,
          characterName: character.name,
          mission: character.mission,
          success: record.chatState.isSuccess,
          finalAffection: record.chatState.affection,
          messages: record.chatState.messages,
        };
      })
      .filter(Boolean) as AllConversationsPayload["allConversations"];

    return { allConversations };
  },

  reset(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
  },
};

export function getCharacterProgress(characterId: string) {
  return storage.load()?.characters[characterId];
}

export function getCompletedCharacterIds() {
  const data = storage.load() ?? createEmptyData();
  return getCharacters()
    .map((character) => character.id)
    .filter((id) => data.characters[id]?.chatState?.isGameOver);
}
