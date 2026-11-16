import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'SC-ADMIN-2026';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const STORE_PATH = path.resolve(__dirname, '.sc-games-store.json');

interface StoredLeaderboardEntry {
  id: string;
  gameId: string;
  playerName: string;
  score: number;
  createdAt: string;
}

interface StoredErrorReport {
  id: string;
  timestamp: string;
  source: string;
  gameId?: string;
  message: string;
  stack?: string;
  line?: number;
  contactEmail?: string;
  status: 'open' | 'diagnosed' | 'resolved' | 'rolled-back';
  aiDiagnosis?: {
    probableCause: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestedFix: string;
    safeAutoRepairAction: string | null;
    requiresAdminApproval: boolean;
    verificationSteps: string[];
    analyzedAt: string;
  };
}

interface AdminGameOverride {
  enabled?: boolean;
  offlineCompatible?: boolean;
  featured?: boolean;
  version?: string;
  shortDesc?: string;
}

interface AdConfig {
  homeBannerEnabled: boolean;
  sidebarSponsorEnabled: boolean;
  kidsZoneAdsAllowed: false;
  monthlyEstimatedRpmInr: number;
}

interface SnapshotEntry {
  id: string;
  createdAt: string;
  note: string;
  gameOverrides: Record<string, AdminGameOverride>;
}

interface ServerStore {
  totalVisits: number;
  gamePlays: Record<string, number>;
  leaderboard: StoredLeaderboardEntry[];
  reports: StoredErrorReport[];
  gameOverrides: Record<string, AdminGameOverride>;
  adConfig: AdConfig;
  snapshots: SnapshotEntry[];
}

const DEFAULT_STORE: ServerStore = {
  totalVisits: 1420,
  gamePlays: {
    'color-match': 312,
    'memory-flip': 418,
    'turbo-gp': 504,
    'chess-master': 389,
    'bubble-pop': 276,
    'sudoku-classic': 294,
    'word-search': 241,
    'cricket-super-over': 350,
  },
  leaderboard: [
    { id: 'lb-1', gameId: 'turbo-gp', playerName: 'Aarav', score: 2450, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'lb-2', gameId: 'memory-flip', playerName: 'Meera', score: 1820, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'lb-3', gameId: 'brick-breaker', playerName: 'Rohan', score: 3100, createdAt: new Date(Date.now() - 3600000 * 12).toISOString() },
    { id: 'lb-4', gameId: 'star-blaster', playerName: 'Ananya', score: 4200, createdAt: new Date(Date.now() - 3600000 * 6).toISOString() },
    { id: 'lb-5', gameId: 'cricket-super-over', playerName: 'Vikram', score: 34, createdAt: new Date(Date.now() - 3600000 * 2).toISOString() },
  ],
  reports: [],
  gameOverrides: {},
  adConfig: {
    homeBannerEnabled: true,
    sidebarSponsorEnabled: false,
    kidsZoneAdsAllowed: false,
    monthlyEstimatedRpmInr: 100,
  },
  snapshots: [],
};

function loadStore(): ServerStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')) as Partial<ServerStore>;
      return {
        ...DEFAULT_STORE,
        ...parsed,
        adConfig: {
          ...DEFAULT_STORE.adConfig,
          ...(parsed.adConfig || {}),
          kidsZoneAdsAllowed: false,
        },
      };
    }
  } catch (err) {
    console.error('Failed to read store file, using defaults:', err);
  }
  return structuredClone(DEFAULT_STORE);
}

let store: ServerStore = loadStore();

function saveStore() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

function signAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', iat: Date.now(), exp: Date.now() + 1000 * 60 * 60 * 12 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { exp?: number; role?: string };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  next();
}

function sanitizeText(value: unknown, maxLen = 200): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

function stripSensitiveData(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, '[REDACTED_TOKEN]')
    .replace(/(password|passcode|secret|apiKey|api_key)\s*[:=]\s*["']?[^\s,"'}]+/gi, '$1=[REDACTED]')
    .slice(0, 1500);
}

// --- WebSocket Multiplayer Rooms ---
type MultiplayerGameType = 'tic-tac-toe' | 'connect-four' | 'rps-arena';

interface RoomPlayer {
  id: string;
  name: string;
  ws: WebSocket;
  slot: 0 | 1;
}

interface GameRoom {
  code: string;
  gameType: MultiplayerGameType;
  players: RoomPlayer[];
  turn: 0 | 1;
  winner: number | 'draw' | null;
  board: (number | null)[];
  rpsChoices: [string | null, string | null];
  rpsScores: [number, number];
  chatHistory: { sender: string; text: string; time: string }[];
  createdAt: number;
}

const rooms = new Map<string, GameRoom>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function createInitialBoard(gameType: MultiplayerGameType): (number | null)[] {
  if (gameType === 'tic-tac-toe') return Array(9).fill(null);
  if (gameType === 'connect-four') return Array(42).fill(null);
  return [];
}

function serializeRoom(room: GameRoom, viewerSlot?: 0 | 1) {
  return {
    code: room.code,
    gameType: room.gameType,
    players: room.players.map((p) => ({ id: p.id, name: p.name, slot: p.slot })),
    turn: room.turn,
    winner: room.winner,
    board: room.board,
    rpsReady: [room.rpsChoices[0] !== null, room.rpsChoices[1] !== null],
    rpsReveal:
      room.rpsChoices[0] !== null && room.rpsChoices[1] !== null
        ? room.rpsChoices
        : [
            viewerSlot === 0 ? room.rpsChoices[0] : null,
            viewerSlot === 1 ? room.rpsChoices[1] : null,
          ],
    rpsScores: room.rpsScores,
    chatHistory: room.chatHistory.slice(-20),
  };
}

function broadcastRoom(room: GameRoom) {
  for (const p of room.players) {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({ type: 'room:state', room: serializeRoom(room, p.slot) }));
    }
  }
}

function checkTicTacToeWinner(board: (number | null)[]): number | 'draw' | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.every((cell) => cell !== null) ? 'draw' : null;
}

function checkConnectFourWinner(board: (number | null)[]): number | 'draw' | null {
  const rows = 6;
  const cols = 7;
  const at = (r: number, c: number) => board[r * cols + c];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = at(r, c);
      if (p === null) continue;
      if (c + 3 < cols && p === at(r, c + 1) && p === at(r, c + 2) && p === at(r, c + 3)) return p;
      if (r + 3 < rows && p === at(r + 1, c) && p === at(r + 2, c) && p === at(r + 3, c)) return p;
      if (r + 3 < rows && c + 3 < cols && p === at(r + 1, c + 1) && p === at(r + 2, c + 2) && p === at(r + 3, c + 3)) return p;
      if (r + 3 < rows && c - 3 >= 0 && p === at(r + 1, c - 1) && p === at(r + 2, c - 2) && p === at(r + 3, c - 3)) return p;
    }
  }
  return board.every((cell) => cell !== null) ? 'draw' : null;
}

const SAFE_PRESET_MESSAGES = [
  'Good luck!',
  'Nice move!',
  'Well played!',
  'Rematch?',
  'Fun game!',
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health & Telemetry
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      activeRooms: rooms.size,
      totalVisits: store.totalVisits,
    });
  });

  app.post('/api/analytics/visit', (_req, res) => {
    store.totalVisits += 1;
    saveStore();
    res.json({ totalVisits: store.totalVisits });
  });

  app.post('/api/analytics/play', (req, res) => {
    const gameId = sanitizeText(req.body?.gameId, 64);
    if (!gameId) {
      res.status(400).json({ error: 'gameId is required' });
      return;
    }
    store.gamePlays[gameId] = (store.gamePlays[gameId] || 0) + 1;
    saveStore();
    res.json({ gameId, plays: store.gamePlays[gameId] });
  });

  app.get('/api/analytics', (_req, res) => {
    res.json({
      totalVisits: store.totalVisits,
      gamePlays: store.gamePlays,
      totalPlays: Object.values(store.gamePlays).reduce((a, b) => a + b, 0),
      openReports: store.reports.filter((r) => r.status === 'open').length,
      adConfig: store.adConfig,
    });
  });

  app.get('/api/catalog-overrides', (_req, res) => {
    res.json({
      gameOverrides: store.gameOverrides,
      adConfig: store.adConfig,
    });
  });

  // Leaderboard
  app.get('/api/leaderboard', (req, res) => {
    const gameId = sanitizeText(req.query.gameId, 64);
    const entries = store.leaderboard
      .filter((e) => !gameId || e.gameId === gameId)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);
    res.json({ entries });
  });

  app.post('/api/leaderboard', (req, res) => {
    const gameId = sanitizeText(req.body?.gameId, 64);
    const playerName = sanitizeText(req.body?.playerName, 24) || 'Player';
    const score = Number(req.body?.score);
    if (!gameId || !Number.isFinite(score) || score < 0) {
      res.status(400).json({ error: 'Valid gameId and non-negative score required.' });
      return;
    }
    const entry: StoredLeaderboardEntry = {
      id: `lb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      gameId,
      playerName,
      score: Math.round(score),
      createdAt: new Date().toISOString(),
    };
    store.leaderboard.push(entry);
    store.leaderboard = store.leaderboard
      .sort((a, b) => b.score - a.score)
      .slice(0, 250);
    saveStore();
    res.status(201).json({ entry });
  });

  // Public Reports / Contact
  app.get('/api/reports', (_req, res) => {
    res.json({ reports: store.reports.slice(0, 50) });
  });

  app.post('/api/reports', (req, res) => {
    const message = stripSensitiveData(sanitizeText(req.body?.message, 600));
    const source = sanitizeText(req.body?.source, 80) || 'user-report';
    const gameId = sanitizeText(req.body?.gameId, 64) || undefined;
    const contactEmail = sanitizeText(req.body?.contactEmail, 100) || undefined;
    const line = typeof req.body?.line === 'number' ? req.body.line : undefined;

    if (!message) {
      res.status(400).json({ error: 'Report message is required.' });
      return;
    }

    const report: StoredErrorReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      source,
      gameId,
      message,
      line,
      contactEmail,
      status: 'open',
    };
    store.reports.unshift(report);
    store.reports = store.reports.slice(0, 100);
    saveStore();
    res.status(201).json({ report });
  });

  // SC AI Game Doctor (Gemini API Server-Side)
  app.post('/api/doctor/diagnose', async (req, res) => {
    const reportId = sanitizeText(req.body?.reportId, 64);
    const rawError = stripSensitiveData(sanitizeText(req.body?.errorText, 1200));
    const gameId = sanitizeText(req.body?.gameId, 64) || 'platform';
    const context = stripSensitiveData(sanitizeText(req.body?.context, 600));

    if (!rawError) {
      res.status(400).json({ error: 'errorText is required for diagnosis.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in server secrets. Configure it in Settings > Secrets to run live AI diagnostics.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Analyze this SC GAMES web platform / HTML5 game diagnostic event and propose a safe recovery plan.
Game/Module ID: ${gameId}
Error Message: ${rawError}
Runtime Context: ${context || 'Web PWA Client'}

Remember safety rules:
- Never suggest blind live code edits; mark code changes as requiresAdminApproval: true.
- Safe automated repairs include clearing stale cache, resetting corrupted local game progress key, or reloading module state (safeAutoRepairAction: "clear_stale_cache" | "reset_game_storage" | "refresh_sw" | null).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are SC AI Game Doctor, a reliability engineer for the SC GAMES all-ages web gaming platform. Provide concise, accurate root-cause diagnoses and safe repair steps.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              probableCause: { type: Type.STRING },
              severity: { type: Type.STRING },
              suggestedFix: { type: Type.STRING },
              safeAutoRepairAction: { type: Type.STRING },
              requiresAdminApproval: { type: Type.BOOLEAN },
              verificationSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'probableCause',
              'severity',
              'suggestedFix',
              'requiresAdminApproval',
              'verificationSteps',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        probableCause?: string;
        severity?: string;
        suggestedFix?: string;
        safeAutoRepairAction?: string;
        requiresAdminApproval?: boolean;
        verificationSteps?: string[];
      };

      const sev = ['low', 'medium', 'high', 'critical'].includes(String(parsed.severity))
        ? (parsed.severity as 'low' | 'medium' | 'high' | 'critical')
        : 'medium';

      const diagnosis = {
        probableCause: parsed.probableCause || 'Transient runtime or asset cache mismatch.',
        severity: sev,
        suggestedFix: parsed.suggestedFix || 'Verify asset cache integrity and reinitialize the game module.',
        safeAutoRepairAction:
          parsed.safeAutoRepairAction && parsed.safeAutoRepairAction !== 'null'
            ? parsed.safeAutoRepairAction
            : null,
        requiresAdminApproval: Boolean(parsed.requiresAdminApproval),
        verificationSteps: Array.isArray(parsed.verificationSteps)
          ? parsed.verificationSteps.slice(0, 5)
          : ['Confirm game module mounts without exceptions', 'Verify keyboard and touch handlers'],
        analyzedAt: new Date().toISOString(),
      };

      if (reportId) {
        const target = store.reports.find((r) => r.id === reportId);
        if (target) {
          target.aiDiagnosis = diagnosis;
          target.status = 'diagnosed';
          saveStore();
        }
      }

      res.json({ diagnosis });
    } catch (err) {
      console.error('SC AI Game Doctor error:', err);
      const message = err instanceof Error ? err.message : 'AI diagnostic request failed.';
      res.status(502).json({ error: message });
    }
  });

  // Admin Auth & Endpoints
  app.post('/api/admin/login', (req, res) => {
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    if (!passcode || passcode !== ADMIN_PASSCODE) {
      res.status(401).json({ error: 'Invalid administrator passcode.' });
      return;
    }
    const token = signAdminToken();
    res.json({ token, role: 'admin' });
  });

  app.get('/api/admin/session', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    res.json({ authenticated: verifyAdminToken(token) });
  });

  app.patch('/api/admin/games/:gameId', requireAdmin, (req, res) => {
    const gameId = sanitizeText(req.params.gameId, 64);
    if (!gameId) {
      res.status(400).json({ error: 'Invalid gameId' });
      return;
    }

    // Create rollback snapshot before modifying
    store.snapshots.unshift({
      id: `snap-${Date.now()}`,
      createdAt: new Date().toISOString(),
      note: `Before updating ${gameId}`,
      gameOverrides: structuredClone(store.gameOverrides),
    });
    store.snapshots = store.snapshots.slice(0, 15);

    const existing = store.gameOverrides[gameId] || {};
    const next: AdminGameOverride = { ...existing };
    if (typeof req.body?.enabled === 'boolean') next.enabled = req.body.enabled;
    if (typeof req.body?.offlineCompatible === 'boolean') next.offlineCompatible = req.body.offlineCompatible;
    if (typeof req.body?.featured === 'boolean') next.featured = req.body.featured;
    if (typeof req.body?.version === 'string') next.version = sanitizeText(req.body.version, 20);
    if (typeof req.body?.shortDesc === 'string') next.shortDesc = sanitizeText(req.body.shortDesc, 220);

    store.gameOverrides[gameId] = next;
    saveStore();
    res.json({ gameId, override: next, snapshots: store.snapshots });
  });

  app.patch('/api/admin/ads', requireAdmin, (req, res) => {
    if (typeof req.body?.homeBannerEnabled === 'boolean') {
      store.adConfig.homeBannerEnabled = req.body.homeBannerEnabled;
    }
    if (typeof req.body?.sidebarSponsorEnabled === 'boolean') {
      store.adConfig.sidebarSponsorEnabled = req.body.sidebarSponsorEnabled;
    }
    if (typeof req.body?.monthlyEstimatedRpmInr === 'number' && req.body.monthlyEstimatedRpmInr >= 0) {
      store.adConfig.monthlyEstimatedRpmInr = Math.min(10000, Math.round(req.body.monthlyEstimatedRpmInr));
    }
    store.adConfig.kidsZoneAdsAllowed = false; // Strictly enforced child safety policy
    saveStore();
    res.json({ adConfig: store.adConfig });
  });

  app.patch('/api/admin/reports/:id', requireAdmin, (req, res) => {
    const id = sanitizeText(req.params.id, 64);
    const status = req.body?.status;
    const report = store.reports.find((r) => r.id === id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    if (status === 'open' || status === 'diagnosed' || status === 'resolved' || status === 'rolled-back') {
      report.status = status;
      saveStore();
    }
    res.json({ report });
  });

  app.post('/api/admin/rollback', requireAdmin, (req, res) => {
    const snapshotId = sanitizeText(req.body?.snapshotId, 64);
    const snap = store.snapshots.find((s) => s.id === snapshotId) || store.snapshots[0];
    if (!snap) {
      res.status(404).json({ error: 'No rollback snapshot available.' });
      return;
    }
    store.gameOverrides = structuredClone(snap.gameOverrides);
    saveStore();
    res.json({ restoredSnapshotId: snap.id, gameOverrides: store.gameOverrides });
  });

  app.get('/api/admin/snapshots', requireAdmin, (_req, res) => {
    res.json({ snapshots: store.snapshots });
  });

  // Public multiplayer room directory
  app.get('/api/multiplayer/rooms', (_req, res) => {
    const openRooms = Array.from(rooms.values())
      .filter((r) => r.players.length < 2)
      .map((r) => ({
        code: r.code,
        gameType: r.gameType,
        hostName: r.players[0]?.name || 'Host',
        playersCount: r.players.length,
      }));
    res.json({ rooms: openRooms });
  });

  const server = http.createServer(app);

  // Vite Dev or Production Static Serving
  if (process.env.NODE_ENV !== 'production') {
    if (!process.env.DISABLE_HMR) {
      process.env.DISABLE_HMR = 'true';
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
        ws: { server, path: '/__vite_ws' },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
      if (pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    let currentRoomCode: string | null = null;
    const playerId = `p-${crypto.randomBytes(4).toString('hex')}`;

    const leaveCurrentRoom = () => {
      if (!currentRoomCode) return;
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.players = room.players.filter((p) => p.id !== playerId);
        if (room.players.length === 0) {
          rooms.delete(currentRoomCode);
        } else {
          broadcastRoom(room);
        }
      }
      currentRoomCode = null;
    };

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          gameType?: MultiplayerGameType;
          playerName?: string;
          code?: string;
          index?: number;
          col?: number;
          choice?: string;
          presetIndex?: number;
        };

        if (msg.type === 'room:create') {
          leaveCurrentRoom();
          const gameType: MultiplayerGameType =
            msg.gameType === 'connect-four' || msg.gameType === 'rps-arena'
              ? msg.gameType
              : 'tic-tac-toe';
          const code = generateRoomCode();
          const name = sanitizeText(msg.playerName, 20) || 'Player 1';
          const room: GameRoom = {
            code,
            gameType,
            players: [{ id: playerId, name, ws, slot: 0 }],
            turn: 0,
            winner: null,
            board: createInitialBoard(gameType),
            rpsChoices: [null, null],
            rpsScores: [0, 0],
            chatHistory: [],
            createdAt: Date.now(),
          };
          rooms.set(code, room);
          currentRoomCode = code;
          ws.send(JSON.stringify({ type: 'room:joined', slot: 0, playerId, room: serializeRoom(room, 0) }));
          return;
        }

        if (msg.type === 'room:join') {
          const code = sanitizeText(msg.code, 10).toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            ws.send(JSON.stringify({ type: 'room:error', error: 'Room not found. Check the 6-character code.' }));
            return;
          }
          if (room.players.length >= 2) {
            ws.send(JSON.stringify({ type: 'room:error', error: 'Room is already full (2/2 players).' }));
            return;
          }
          leaveCurrentRoom();
          const usedSlot = room.players[0]?.slot === 0 ? 1 : 0;
          const name = sanitizeText(msg.playerName, 20) || 'Player 2';
          room.players.push({ id: playerId, name, ws, slot: usedSlot });
          currentRoomCode = code;
          ws.send(JSON.stringify({ type: 'room:joined', slot: usedSlot, playerId, room: serializeRoom(room, usedSlot) }));
          broadcastRoom(room);
          return;
        }

        if (msg.type === 'room:leave') {
          leaveCurrentRoom();
          ws.send(JSON.stringify({ type: 'room:left' }));
          return;
        }

        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return;

        if (msg.type === 'game:move') {
          if (room.players.length < 2 || room.winner !== null) return;

          if (room.gameType === 'tic-tac-toe') {
            if (room.turn !== player.slot) return;
            const idx = Number(msg.index);
            if (!Number.isInteger(idx) || idx < 0 || idx > 8 || room.board[idx] !== null) return;
            room.board[idx] = player.slot;
            room.winner = checkTicTacToeWinner(room.board);
            if (room.winner === null) room.turn = room.turn === 0 ? 1 : 0;
            broadcastRoom(room);
            return;
          }

          if (room.gameType === 'connect-four') {
            if (room.turn !== player.slot) return;
            const col = Number(msg.col);
            if (!Number.isInteger(col) || col < 0 || col > 6) return;
            let placed = false;
            for (let r = 5; r >= 0; r--) {
              if (room.board[r * 7 + col] === null) {
                room.board[r * 7 + col] = player.slot;
                placed = true;
                break;
              }
            }
            if (!placed) return;
            room.winner = checkConnectFourWinner(room.board);
            if (room.winner === null) room.turn = room.turn === 0 ? 1 : 0;
            broadcastRoom(room);
            return;
          }

          if (room.gameType === 'rps-arena') {
            const choice = msg.choice;
            if (choice !== 'rock' && choice !== 'paper' && choice !== 'scissors') return;
            room.rpsChoices[player.slot] = choice;
            const [c0, c1] = room.rpsChoices;
            if (c0 && c1) {
              if (c0 === c1) {
                room.winner = 'draw';
              } else if (
                (c0 === 'rock' && c1 === 'scissors') ||
                (c0 === 'paper' && c1 === 'rock') ||
                (c0 === 'scissors' && c1 === 'paper')
              ) {
                room.winner = 0;
                room.rpsScores[0] += 1;
              } else {
                room.winner = 1;
                room.rpsScores[1] += 1;
              }
            }
            broadcastRoom(room);
            return;
          }
        }

        if (msg.type === 'game:rematch') {
          room.board = createInitialBoard(room.gameType);
          room.rpsChoices = [null, null];
          room.winner = null;
          room.turn = 0;
          broadcastRoom(room);
          return;
        }

        if (msg.type === 'chat:preset') {
          const idx = Number(msg.presetIndex);
          if (!Number.isInteger(idx) || idx < 0 || idx >= SAFE_PRESET_MESSAGES.length) return;
          room.chatHistory.push({
            sender: player.name,
            text: SAFE_PRESET_MESSAGES[idx],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
          broadcastRoom(room);
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', leaveCurrentRoom);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SC GAMES server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SC GAMES server:', err);
  process.exit(1);
});
