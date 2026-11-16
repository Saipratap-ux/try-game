import type { ErrorLogEntry, GameProgress, PlayerProfile } from '../types/game';

const DB_NAME = 'sc-games-db';
const DB_VERSION = 1;
const STORE_PROGRESS = 'progress';
const STORE_OFFLINE = 'offline_bundles';

const PROFILE_KEY = 'sc_games_profile_v1';
const FAV_KEY = 'sc_games_favourites_v1';
const RECENT_KEY = 'sc_games_recent_v1';
const PROGRESS_KEY = 'sc_games_progress_v1';
const OFFLINE_KEY = 'sc_games_offline_ids_v1';
const ERROR_LOGS_KEY = 'sc_games_error_logs_v1';

export const DEFAULT_PROFILE: PlayerProfile = {
  name: 'Guest Player',
  preferredAgeGroup: 'all',
  soundEnabled: true,
  parentLockKidsSafe: false,
  theme: 'dark',
  achievements: [],
};

function openIDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
          db.createObjectStore(STORE_PROGRESS, { keyPath: 'gameId' });
        }
        if (!db.objectStoreNames.contains(STORE_OFFLINE)) {
          db.createObjectStore(STORE_OFFLINE, { keyPath: 'gameId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadFavourites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? (JSON.parse(raw) as string[]) : ['color-match', 'chess-master', 'turbo-gp'];
  } catch {
    return [];
  }
}

export function saveFavourites(ids: string[]): void {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  } catch {
    // Ignore
  }
}

export function loadRecentlyPlayed(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : ['memory-flip', 'turbo-gp', 'cricket-super-over'];
  } catch {
    return [];
  }
}

export function pushRecentlyPlayed(gameId: string): string[] {
  const existing = loadRecentlyPlayed().filter((id) => id !== gameId);
  const next = [gameId, ...existing].slice(0, 12);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function loadAllProgress(): Record<string, GameProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, GameProgress>) : {};
  } catch {
    return {};
  }
}

export async function recordGameProgress(gameId: string, score: number): Promise<Record<string, GameProgress>> {
  const all = loadAllProgress();
  const prev = all[gameId];
  const updated: GameProgress = {
    gameId,
    highScore: Math.max(prev?.highScore || 0, Math.round(score)),
    plays: (prev?.plays || 0) + 1,
    lastPlayedAt: new Date().toISOString(),
  };
  all[gameId] = updated;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    // Ignore
  }

  const db = await openIDB();
  if (db) {
    try {
      const tx = db.transaction(STORE_PROGRESS, 'readwrite');
      tx.objectStore(STORE_PROGRESS).put(updated);
    } catch {
      // Ignore IDB error
    }
  }
  return all;
}

export function loadOfflineGameIds(): string[] {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    return raw
      ? (JSON.parse(raw) as string[])
      : ['color-match', 'memory-flip', 'tic-tac-toe', 'chess-master', 'brick-breaker'];
  } catch {
    return [];
  }
}

export async function downloadGameForOffline(gameId: string, version: string): Promise<string[]> {
  const current = loadOfflineGameIds();
  const next = current.includes(gameId) ? current : [...current, gameId];
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }

  // Persist offline bundle metadata in IndexedDB
  const db = await openIDB();
  if (db) {
    try {
      const tx = db.transaction(STORE_OFFLINE, 'readwrite');
      tx.objectStore(STORE_OFFLINE).put({
        gameId,
        version,
        cachedAt: new Date().toISOString(),
        ready: true,
      });
    } catch {
      // Ignore
    }
  }

  // Also warm Browser Cache Storage with core shell assets
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('sc-games-offline-v1');
      await cache.addAll(['/', '/index.html', '/icon.svg', '/pwa-192x192.png']);
    } catch {
      // Cache API may not resolve dev-only modules, gracefully continue with IDB cache
    }
  }

  return next;
}

export function removeOfflineGame(gameId: string): string[] {
  const next = loadOfflineGameIds().filter((id) => id !== gameId);
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function loadErrorLogs(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(ERROR_LOGS_KEY);
    return raw ? (JSON.parse(raw) as ErrorLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveErrorLogs(logs: ErrorLogEntry[]): void {
  try {
    localStorage.setItem(ERROR_LOGS_KEY, JSON.stringify(logs.slice(0, 40)));
  } catch {
    // Ignore
  }
}

export async function clearAllLocalGameData(): Promise<void> {
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(RECENT_KEY);
  localStorage.removeItem(FAV_KEY);
  localStorage.removeItem(OFFLINE_KEY);
  localStorage.removeItem(ERROR_LOGS_KEY);
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}
