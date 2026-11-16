import React, { useEffect, useRef, useState } from 'react';
import { Users, Wifi, WifiOff, Copy, Check, Send, RotateCcw, LogOut } from 'lucide-react';
import { soundFx } from '../utils/soundFx';

type MultiplayerGameType = 'tic-tac-toe' | 'connect-four' | 'rps-arena';

interface RoomState {
  code: string;
  gameType: MultiplayerGameType;
  players: { id: string; name: string; slot: 0 | 1 }[];
  turn: 0 | 1;
  winner: number | 'draw' | null;
  board: (number | null)[];
  rpsReady: [boolean, boolean];
  rpsReveal: [string | null, string | null];
  rpsScores: [number, number];
  chatHistory: { sender: string; text: string; time: string }[];
}

interface OpenRoomSummary {
  code: string;
  gameType: MultiplayerGameType;
  hostName: string;
  playersCount: number;
}

const PRESET_CHATS = [
  'Good luck!',
  'Nice move!',
  'Well played!',
  'Rematch?',
  'Fun game!',
];

export const MultiplayerArena: React.FC<{ playerName: string; isOnline: boolean }> = ({
  playerName,
  isOnline,
}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [mySlot, setMySlot] = useState<0 | 1>(0);
  const [selectedType, setSelectedType] = useState<MultiplayerGameType>('tic-tac-toe');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<OpenRoomSummary[]>([]);
  const [copied, setCopied] = useState(false);

  const loadOpenRooms = async () => {
    try {
      const res = await fetch('/api/multiplayer/rooms');
      if (res.ok) {
        const data = (await res.json()) as { rooms: OpenRoomSummary[] };
        setOpenRooms(data.rooms || []);
      }
    } catch {
      // Ignore when offline
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    void loadOpenRooms();

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };
    ws.onclose = () => {
      setConnected(false);
    };
    ws.onerror = () => {
      setError('Real-time multiplayer connection unavailable.');
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as {
          type: string;
          room?: RoomState;
          slot?: 0 | 1;
          error?: string;
        };
        if (msg.type === 'room:joined' && msg.room) {
          setRoom(msg.room);
          setMySlot(msg.slot ?? 0);
          setError(null);
          soundFx.match();
        } else if (msg.type === 'room:state' && msg.room) {
          setRoom(msg.room);
        } else if (msg.type === 'room:left') {
          setRoom(null);
          void loadOpenRooms();
        } else if (msg.type === 'room:error') {
          setError(msg.error || 'Room error');
        }
      } catch {
        // Ignore malformed frame
      }
    };

    return () => {
      ws.close();
    };
  }, [isOnline]);

  const sendMsg = (payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const copyRoomCode = () => {
    if (!room) return;
    void navigator.clipboard?.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!isOnline) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-center">
        <WifiOff className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Internet Required for Online Multiplayer</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Your device appears offline. Switch to Offline Games or local 2-player Chess, Ludo, Tic-Tac-Toe, and Connect Four while disconnected.
        </p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Multiplayer Game Rooms</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Real-time WebSocket rooms with server-authoritative turns and child-safe preset chat.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
              <Wifi className={`w-4 h-4 ${connected ? 'text-emerald-500' : 'text-amber-500'}`} />
              {connected ? 'Socket Connected' : 'Connecting...'}
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Room */}
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white">Create a Room</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'tic-tac-toe', label: 'Tic-Tac-Toe' },
                  { id: 'connect-four', label: 'Connect Four' },
                  { id: 'rps-arena', label: 'RPS Arena' },
                ].map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedType(g.id as MultiplayerGameType)}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition ${
                      selectedType === g.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => sendMsg({ type: 'room:create', gameType: selectedType, playerName })}
                disabled={!connected}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm"
              >
                Create Room as {playerName}
              </button>
            </div>

            {/* Join Room */}
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white">Join with Room Code</h3>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-char code (e.g. AB34XY)"
                  maxLength={6}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-sm uppercase text-slate-900 dark:text-white"
                />
                <button
                  onClick={() => sendMsg({ type: 'room:join', code: joinCode, playerName })}
                  disabled={!connected || joinCode.length < 4}
                  className="px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-sm whitespace-nowrap"
                >
                  Join Room
                </button>
              </div>
              <button
                onClick={() => void loadOpenRooms()}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Refresh Open Lobby List
              </button>
            </div>
          </div>
        </div>

        {/* Open Rooms Directory */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" /> Open Rooms Waiting for Player 2
          </h3>
          {openRooms.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No open rooms right now. Create a room above and share the 6-character code with a friend or open a second tab to play live!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {openRooms.map((r) => (
                <div
                  key={r.code}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <p className="font-mono font-bold text-slate-900 dark:text-white">{r.code}</p>
                    <p className="text-xs text-slate-500">
                      {r.gameType} · Host: {r.hostName}
                    </p>
                  </div>
                  <button
                    onClick={() => sendMsg({ type: 'room:join', code: r.code, playerName })}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const opp = room.players.find((p) => p.slot !== mySlot);
  const isMyTurn = room.turn === mySlot && room.players.length === 2 && room.winner === null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Active Board */}
      <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white">
              Room: {room.code}
            </span>
            <button
              onClick={copyRoomCode}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sendMsg({ type: 'game:rematch' })}
              className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Rematch
            </button>
            <button
              onClick={() => sendMsg({ type: 'room:leave' })}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" /> Leave
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {room.players.length < 2
              ? `Waiting for Player 2 to join code ${room.code}...`
              : room.winner === 'draw'
                ? 'Match Draw!'
                : room.winner !== null
                  ? `${room.winner === mySlot ? 'You Won!' : `${opp?.name || 'Opponent'} Won!`}`
                  : isMyTurn
                    ? 'Your Turn!'
                    : `Waiting for ${opp?.name || 'Opponent'}...`}
          </p>
        </div>

        {room.gameType === 'tic-tac-toe' && (
          <div className="grid grid-cols-3 gap-2.5 w-64">
            {room.board.map((cell, i) => (
              <button
                key={i}
                disabled={!isMyTurn || cell !== null}
                onClick={() => sendMsg({ type: 'game:move', index: i })}
                className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-3xl font-extrabold flex items-center justify-center hover:border-blue-500"
              >
                <span className={cell === 0 ? 'text-blue-500' : 'text-purple-500'}>
                  {cell === 0 ? 'X' : cell === 1 ? 'O' : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        {room.gameType === 'connect-four' && (
          <div className="bg-blue-800 p-3 rounded-2xl grid grid-cols-7 gap-1.5 w-full max-w-[340px]">
            {room.board.map((cell, idx) => {
              const col = idx % 7;
              return (
                <button
                  key={idx}
                  disabled={!isMyTurn}
                  onClick={() => sendMsg({ type: 'game:move', col })}
                  className={`aspect-square rounded-full ${
                    cell === 0 ? 'bg-sky-400' : cell === 1 ? 'bg-amber-400' : 'bg-slate-950/75 hover:bg-slate-900'
                  }`}
                />
              );
            })}
          </div>
        )}

        {room.gameType === 'rps-arena' && (
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="flex justify-center gap-6 font-mono text-sm">
              <span>You: {room.rpsScores[mySlot]}</span>
              <span>Opponent: {room.rpsScores[mySlot === 0 ? 1 : 0]}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['rock', 'paper', 'scissors'] as const).map((choice) => (
                <button
                  key={choice}
                  disabled={room.players.length < 2 || room.winner !== null || room.rpsReady[mySlot]}
                  onClick={() => sendMsg({ type: 'game:move', choice })}
                  className="py-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-blue-500 font-bold capitalize disabled:opacity-50"
                >
                  {choice}
                </button>
              ))}
            </div>
            {room.winner !== null && (
              <p className="text-sm text-blue-500 font-semibold">
                Revealed: P1 ({room.rpsReveal[0]}) vs P2 ({room.rpsReveal[1]})
              </p>
            )}
          </div>
        )}
      </div>

      {/* Safe Preset Chat Sidebar (Child-Safe: No free-text open chat) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">Safe Quick Chat</h3>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {room.chatHistory.length === 0 ? (
              <p className="text-xs text-slate-500">Tap a friendly preset message below.</p>
            ) : (
              room.chatHistory.map((c, idx) => (
                <div key={idx} className="text-xs p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80">
                  <span className="font-bold text-blue-600 dark:text-blue-400">{c.sender}: </span>
                  <span className="text-slate-800 dark:text-slate-200">{c.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_CHATS.map((text, idx) => (
            <button
              key={text}
              onClick={() => sendMsg({ type: 'chat:preset', presetIndex: idx })}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-xs font-medium inline-flex items-center gap-1 transition-colors"
            >
              <Send className="w-3 h-3" /> {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
