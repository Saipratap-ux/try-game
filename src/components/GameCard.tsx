import React, { useState } from 'react';
import { Play, Heart, Download, Check, Users } from 'lucide-react';
import type { GameMetadata } from '../types/game';
import { CATEGORY_LABELS } from '../data/gamesCatalog';

interface GameCardProps {
  game: GameMetadata;
  isFavourite: boolean;
  isOfflineCached: boolean;
  highScore?: number;
  onPlay: (game: GameMetadata) => void;
  onToggleFavourite: (id: string) => void;
  onDownloadOffline: (id: string, version: string) => Promise<void>;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  isFavourite,
  isOfflineCached,
  highScore,
  onPlay,
  onToggleFavourite,
  onDownloadOffline,
}) => {
  const [downloading, setDownloading] = useState(false);

  const handleOffline = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading || !game.offlineCompatible) return;
    setDownloading(true);
    await onDownloadOffline(game.id, game.version);
    setDownloading(false);
  };

  return (
    <article className="group rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 transition-colors flex flex-col justify-between p-5 gap-4">
      <div>
        {/* Clean visual accent strip + title without pill sandwiches */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{CATEGORY_LABELS[game.category]}</span>
              <span aria-hidden="true">·</span>
              <span>{game.minAgeLabel}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
              {game.title}
            </h3>
          </div>

          <button
            onClick={() => onToggleFavourite(game.id)}
            aria-label={isFavourite ? `Remove ${game.title} from favourites` : `Add ${game.title} to favourites`}
            className={`p-2 rounded-lg border transition-colors shrink-0 ${
              isFavourite
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavourite ? 'fill-current' : ''}`} />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {game.shortDesc}
        </p>

        {/* Quiet inline metadata */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{game.offlineCompatible ? 'Offline Ready' : 'Online Only'}</span>
          {game.supportsMultiplayer && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                <Users className="w-3.5 h-3.5" /> Multiplayer
              </span>
            </>
          )}
          {typeof highScore === 'number' && highScore > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                Best: {highScore}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <button
          onClick={() => onPlay(game)}
          className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
        >
          <Play className="w-4 h-4 fill-current" /> Play Now
        </button>

        {game.offlineCompatible && (
          <button
            onClick={handleOffline}
            disabled={downloading}
            title={isOfflineCached ? 'Saved for offline play' : 'Download for offline play'}
            aria-label={isOfflineCached ? `${game.title} saved offline` : `Download ${game.title} for offline play`}
            className={`px-3 py-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              isOfflineCached
                ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-500'
            }`}
          >
            {isOfflineCached ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {downloading ? 'Saving' : isOfflineCached ? 'Cached' : 'Offline'}
          </button>
        )}
      </div>
    </article>
  );
};
