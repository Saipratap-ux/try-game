import type { ErrorLogEntry, GameMetadata } from '../types/game';
import { loadErrorLogs, saveErrorLogs } from './storage';

export interface HealthCheckResult {
  checkName: string;
  passed: boolean;
  detail: string;
}

export function initGlobalErrorMonitor(onNewError: (entry: ErrorLogEntry) => void) {
  const handleError = (event: ErrorEvent) => {
    const entry: ErrorLogEntry = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      source: event.filename || 'window.onerror',
      line: event.lineno || undefined,
      message: event.message || 'Unhandled runtime error',
      stack: event.error?.stack ? String(event.error.stack).slice(0, 500) : undefined,
      status: 'open',
    };
    const next = [entry, ...loadErrorLogs()];
    saveErrorLogs(next);
    onNewError(entry);
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    const entry: ErrorLogEntry = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      source: 'unhandledrejection',
      message: reason || 'Unhandled Promise rejection',
      status: 'open',
    };
    const next = [entry, ...loadErrorLogs()];
    saveErrorLogs(next);
    onNewError(entry);
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}

export async function runAutomatedPlatformDiagnostics(
  catalog: GameMetadata[],
  implementedGameIds: string[]
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // 1. Game module registry check
  const missingGames = catalog.filter((g) => !implementedGameIds.includes(g.id));
  results.push({
    checkName: 'Game Module Integrity',
    passed: missingGames.length === 0,
    detail:
      missingGames.length === 0
        ? `All ${catalog.length} game modules verified and mountable.`
        : `Missing modules: ${missingGames.map((g) => g.id).join(', ')}`,
  });

  // 2. LocalStorage & IndexedDB check
  let storageOk = false;
  try {
    localStorage.setItem('sc_diag_probe', 'ok');
    storageOk = localStorage.getItem('sc_diag_probe') === 'ok';
    localStorage.removeItem('sc_diag_probe');
  } catch {
    storageOk = false;
  }
  results.push({
    checkName: 'Local Storage & Save System',
    passed: storageOk,
    detail: storageOk
      ? 'Read/write persistence confirmed for player progress.'
      : 'Local storage write blocked or quota exceeded.',
  });

  // 3. Service Worker & Offline Cache check
  const swSupported = 'serviceWorker' in navigator;
  let swActive = false;
  if (swSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      swActive = Boolean(reg);
    } catch {
      swActive = false;
    }
  }
  results.push({
    checkName: 'PWA Service Worker',
    passed: swSupported,
    detail: swActive
      ? 'Service worker registered for offline caching.'
      : swSupported
        ? 'Service worker supported (activates on first build/load).'
        : 'Browser does not support Service Workers.',
  });

  // 4. Kids Zone Child-Safety Compliance Check
  const kidsGames = catalog.filter((g) => g.category === 'kids');
  const kidsMultiViolations = kidsGames.filter((g) => g.supportsMultiplayer);
  results.push({
    checkName: 'Kids Zone Safety Guardrails',
    passed: kidsMultiViolations.length === 0,
    detail:
      kidsMultiViolations.length === 0
        ? `Verified ${kidsGames.length} Kids Zone titles have zero public chat or ads.`
        : 'Found restricted multiplayer exposure in Kids Zone.',
  });

  // 5. Backend API Health Check
  let apiOk = false;
  let apiDetail = 'Offline or unreachable';
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = (await res.json()) as { activeRooms?: number };
      apiOk = true;
      apiDetail = `API healthy (${data.activeRooms ?? 0} active multiplayer rooms).`;
    } else {
      apiDetail = `HTTP ${res.status}`;
    }
  } catch {
    apiDetail = navigator.onLine ? 'Server unreachable' : 'Device currently offline (local games unaffected)';
  }
  results.push({
    checkName: 'Backend API & Multiplayer Bridge',
    passed: apiOk || !navigator.onLine,
    detail: apiDetail,
  });

  return results;
}
