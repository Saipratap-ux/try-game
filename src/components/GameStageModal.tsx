import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Download,
  Check,
  Heart,
  Trophy,
  AlertTriangle,
  X,
  ShieldAlert,
} from 'lucide-react';
import type { GameMetadata, LeaderboardEntry } from '../types/game';
import { GameModuleRunner } from '../games/GameRegistry';
import { CATEGORY_LABELS } from '../data/gamesCatalog';

interface GameStageModalProps {
  game: GameMetadata;
  isFavourite: boolean;
  isOfflineCached: boolean;
  soundEnabled: boolean;
  playerName: string;
  onClose: () => void;
  onToggleFavourite: (id: string) => void;
  onDownloadOffline: (id: string, version: string) => Promise<void>;
  onToggleSound: () => void;
  onRecordScore: (gameId: string, score: number, completed?: boolean) => void;
  onOpenReportModal: (gameId: string) => void;
}

export const GameStageModal: React.FC<GameStageModalProps> = ({
  game,
  isFavourite,
  isOfflineCached,
  soundEnabled,
  playerName,
  onClose,
  onToggleFavourite,
  onDownloadOffline,
  onToggleSound,
  onRecordScore,
  onOpenReportModal,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && stageRef.current) {
        await stageRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be restricted inside some sandboxed iframes
    }
  };

  const fetchLeaderboard = async () => {
    setLbLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?gameId=${encodeURIComponent(game.id)}`);
      if (res.ok) {
        const data = (await res.json()) as { entries: LeaderboardEntry[] };
        setLeaderboard(data.entries || []);
      }
    } catch {
      // Offline mode fallback
    } finally {
      setLbLoading(false);
    }
  };

  const handleToggleLeaderboard = () => {
    const next = !showLeaderboard;
    setShowLeaderboard(next);
    if (next) void fetchLeaderboard();
  };

  const handleSubmitScore = async () => {
    if (currentScore <= 0) return;
    setSubmittingScore(true);
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          playerName,
          score: currentScore,
        }),
      });
      if (res.ok) {
        setScoreSubmitted(true);
        void fetchLeaderboard();
      }
    } finally {
      setSubmittingScore(false);
    }
  };

  const handleOfflineClick = async () => {
    setDownloading(true);
    await onDownloadOffline(game.id, game.version);
    setDownloading(false);
  };

  const handleRestart = () => {
    setPaused(false);
    setCurrentScore(0);
    setScoreSubmitted(false);
    setGameKey((k) => k + 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={game.title}
    >
      <div
        ref={stageRef}
        className="w-full max-w-4xl bg-white dark:bg-[#0B1221] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]"
      >
        {/* Top Game HUD */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{CATEGORY_LABELS[game.category]}</span>
              <span aria-hidden="true">·</span>
              <span>{game.minAgeLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">v{game.version}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
              {game.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-blue-300">
              Score: {currentScore}
            </span>

            <button
              onClick={() => setPaused((p) => !p)}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            <button
              onClick={handleRestart}
              className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Restart
            </button>

            <button
              onClick={onToggleSound}
              aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
              className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              aria-label="Close game"
              className="p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Parent Supervision Notice for Ages 1-3 / Kids */}
        {game.ageGroups.includes('1-3') && (
          <div className="px-4 py-2 bg-amber-100 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900 flex items-center gap-2 text-xs font-medium text-amber-950 dark:text-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Parent-Assisted Mode: Recommended for children aged 1–3 with adult supervision. Zero ads or external links.</span>
          </div>
        )}

        {/* Active Game Viewport */}
        <div className="relative flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-[#080D1A]">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-4 text-center max-w-2xl mx-auto">
            {game.instructions}
          </p>

          <GameModuleRunner
            gameId={game.id}
            gameKey={gameKey}
            paused={paused}
            onScore={(sc, completed) => {
              setCurrentScore(sc);
              onRecordScore(game.id, sc, completed);
            }}
          />

          {paused && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center gap-4 z-20">
              <h3 className="text-2xl font-bold text-white">Game Paused</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setPaused(false)}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold inline-flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Resume
                </button>
                <button
                  onClick={handleRestart}
                  className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold inline-flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Restart
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard Drawer if open */}
        {showLeaderboard && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] px-4 py-3 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Online Leaderboard — {game.title}
              </h4>
              <button
                onClick={handleSubmitScore}
                disabled={currentScore <= 0 || submittingScore || scoreSubmitted}
                className="px-3 py-1.5 rounded-lg bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold"
              >
                {scoreSubmitted ? 'Score Posted' : submittingScore ? 'Posting...' : `Submit Score (${currentScore})`}
              </button>
            </div>
            {lbLoading ? (
              <p className="text-xs text-slate-500">Loading scores...</p>
            ) : leaderboard.length === 0 ? (
              <p className="text-xs text-slate-500">No scores recorded yet for this game. Be the first!</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {leaderboard.slice(0, 8).map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800/70"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      #{idx + 1} {entry.playerName}
                    </span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Utility Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onToggleFavourite(game.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border whitespace-nowrap ${
                isFavourite
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              <Heart className="w-3.5 h-3.5" /> {isFavourite ? 'Favourited' : 'Favourite'}
            </button>

            <button
              onClick={handleOfflineClick}
              disabled={downloading || !game.offlineCompatible}
              className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border whitespace-nowrap ${
                isOfflineCached
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              {isOfflineCached ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              {downloading ? 'Caching...' : isOfflineCached ? 'Saved Offline' : 'Offline Download'}
            </button>

            <button
              onClick={handleToggleLeaderboard}
              className="px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 whitespace-nowrap"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" /> Leaderboard
            </button>
          </div>

          <button
            onClick={() => onOpenReportModal(game.id)}
            className="px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 whitespace-nowrap"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Report Error
          </button>
        </div>
      </div>
    </div>
  );
};
