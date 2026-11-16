import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Play,
  ShieldAlert,
  WifiOff,
  Trophy,
  Trash2,
  RefreshCw,
  Award,
  Heart,
  Menu,
  X,
} from 'lucide-react';
import {
  AGE_GROUPS,
  CATEGORY_LABELS,
  INITIAL_GAMES_CATALOG,
} from './data/gamesCatalog';
import type {
  AgeGroupId,
  AppPage,
  ErrorLogEntry,
  GameMetadata,
  GameProgress,
  PlayerProfile,
} from './types/game';
import {
  clearAllLocalGameData,
  downloadGameForOffline,
  loadAllProgress,
  loadErrorLogs,
  loadFavourites,
  loadOfflineGameIds,
  loadProfile,
  loadRecentlyPlayed,
  pushRecentlyPlayed,
  recordGameProgress,
  removeOfflineGame,
  saveFavourites,
  saveProfile,
} from './utils/storage';
import { soundFx } from './utils/soundFx';
import { useOnlineStatus, usePWAInstall } from './utils/pwa';
import { initGlobalErrorMonitor } from './utils/errorMonitor';
import { GameCard } from './components/GameCard';
import { GameStageModal } from './components/GameStageModal';
import { MultiplayerArena } from './components/MultiplayerArena';
import { HelpAndDoctorView } from './components/HelpAndDoctorView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { InstallModal } from './components/InstallModal';

const HERO_IMG = '/src/assets/images/sc_games_hero_banner_1794829112330.jpg';
const LOGO_IMG = '/src/assets/images/sc_games_logo_emblem_1794829113237.jpg';
const KIDS_IMG = '/src/assets/images/sc_zone_kids_1794829113813.jpg';
const RACING_IMG = '/src/assets/images/sc_zone_racing_1794829114284.jpg';
const BRAIN_ARCADE_IMG = '/src/assets/images/sc_zone_arcade_brain_1794829115463.jpg';

const ZONE_LINKS: { page: AppPage; label: string }[] = [
  { page: 'home', label: 'Home' },
  { page: 'all-games', label: 'All Games' },
  { page: 'kids', label: 'Kids Zone' },
  { page: 'brain', label: 'Brain' },
  { page: 'racing', label: 'Racing' },
  { page: 'arcade', label: 'Arcade' },
  { page: 'sports', label: 'Sports' },
  { page: 'family', label: 'Family' },
  { page: 'multiplayer', label: 'Multiplayer' },
  { page: 'offline', label: 'Offline' },
  { page: 'my-games', label: 'My Games' },
  { page: 'profile', label: 'Profile' },
  { page: 'admin', label: 'Admin' },
  { page: 'help', label: 'Help & AI' },
];

export default function App() {
  const isOnline = useOnlineStatus();
  const { canNativePrompt, isInstalled, isIOS, triggerInstall } = usePWAInstall();

  const [page, setPage] = useState<AppPage>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroupId | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<GameMetadata['category'] | 'all'>('all');

  const [profile, setProfile] = useState<PlayerProfile>(loadProfile);
  const [favourites, setFavourites] = useState<string[]>(loadFavourites);
  const [recentIds, setRecentIds] = useState<string[]>(loadRecentlyPlayed);
  const [progressMap, setProgressMap] = useState<Record<string, GameProgress>>(loadAllProgress);
  const [offlineIds, setOfflineIds] = useState<string[]>(loadOfflineGameIds);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>(loadErrorLogs);

  const [overrides, setOverrides] = useState<Record<string, Partial<GameMetadata>>>({});
  const [adHomeBanner, setAdHomeBanner] = useState(true);

  const [activeGame, setActiveGame] = useState<GameMetadata | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reportTargetGame, setReportTargetGame] = useState<string | null>(null);
  const [swUpdateFn, setSwUpdateFn] = useState<(() => void) | null>(null);

  // Sync theme & audio state
  useEffect(() => {
    const root = document.documentElement;
    if (profile.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    soundFx.setMuted(!profile.soundEnabled);
    saveProfile(profile);
  }, [profile]);

  // Global error monitor + SW update prompt + visit analytics
  useEffect(() => {
    const cleanupErrors = initGlobalErrorMonitor((entry) => {
      setErrorLogs((prev) => [entry, ...prev].slice(0, 40));
    });

    const onSwUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ updateSW?: () => void }>).detail;
      if (detail?.updateSW) setSwUpdateFn(() => detail.updateSW);
    };
    window.addEventListener('sc-sw-update-available', onSwUpdate);

    if (navigator.onLine) {
      void fetch('/api/analytics/visit', { method: 'POST' }).catch(() => {});
    }

    return () => {
      cleanupErrors();
      window.removeEventListener('sc-sw-update-available', onSwUpdate);
    };
  }, []);

  const fetchCatalogOverrides = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog-overrides');
      if (res.ok) {
        const data = (await res.json()) as {
          gameOverrides?: Record<string, Partial<GameMetadata>>;
          adConfig?: { homeBannerEnabled?: boolean };
        };
        if (data.gameOverrides) setOverrides(data.gameOverrides);
        if (typeof data.adConfig?.homeBannerEnabled === 'boolean') {
          setAdHomeBanner(data.adConfig.homeBannerEnabled);
        }
      }
    } catch {
      // Offline fallback uses default catalog
    }
  }, []);

  useEffect(() => {
    if (isOnline) void fetchCatalogOverrides();
  }, [isOnline, fetchCatalogOverrides]);

  const catalog = useMemo<GameMetadata[]>(() => {
    return INITIAL_GAMES_CATALOG.map((g) => ({
      ...g,
      ...(overrides[g.id] || {}),
    }));
  }, [overrides]);

  const enabledCatalog = useMemo(() => {
    return catalog.filter((g) => {
      if (!g.enabled) return false;
      if (profile.parentLockKidsSafe && g.category !== 'kids') return false;
      return true;
    });
  }, [catalog, profile.parentLockKidsSafe]);

  const launchGame = (game: GameMetadata) => {
    soundFx.click();
    setActiveGame(game);
    const updatedRecent = pushRecentlyPlayed(game.id);
    setRecentIds(updatedRecent);
    if (navigator.onLine) {
      void fetch('/api/analytics/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id }),
      }).catch(() => {});
    }
  };

  const handleToggleFavourite = (id: string) => {
    soundFx.click();
    setFavourites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveFavourites(next);
      return next;
    });
  };

  const handleDownloadOffline = async (id: string, version: string) => {
    const next = await downloadGameForOffline(id, version);
    setOfflineIds(next);
    soundFx.match();
  };

  const handleRecordScore = useCallback(async (gameId: string, score: number, completed?: boolean) => {
    const updated = await recordGameProgress(gameId, score);
    setProgressMap({ ...updated });
    if (completed && score > 0) {
      setProfile((prev) => {
        const nextAch = new Set(prev.achievements);
        nextAch.add('First Victory');
        if (Object.keys(updated).length >= 5) nextAch.add('Multi-Genre Explorer');
        if (score >= 1000) nextAch.add('High Scorer (1000+)');
        return { ...prev, achievements: Array.from(nextAch) };
      });
    }
  }, []);

  const filteredGames = useMemo(() => {
    return enabledCatalog.filter((g) => {
      if (selectedAgeGroup !== 'all' && !g.ageGroups.includes(selectedAgeGroup)) return false;
      if (categoryFilter !== 'all' && g.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          g.title.toLowerCase().includes(q) ||
          g.shortDesc.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [enabledCatalog, selectedAgeGroup, categoryFilter, searchQuery]);

  const navigate = (nextPage: AppPage) => {
    setPage(nextPage);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInstallAction = async () => {
    if (canNativePrompt) {
      const outcome = await triggerInstall();
      if (outcome === 'manual') setShowInstallModal(true);
    } else {
      setShowInstallModal(true);
    }
  };

  const featuredGames = enabledCatalog.filter((g) => g.featured).slice(0, 6);
  const popularGames = enabledCatalog.filter((g) => g.popular).slice(0, 6);
  const recentGames = recentIds
    .map((id) => enabledCatalog.find((g) => g.id === id))
    .filter((g): g is GameMetadata => Boolean(g));

  const renderGameGrid = (games: GameMetadata[], emptyText: string) => {
    if (games.length === 0) {
      return (
        <div className="p-8 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">{emptyText}</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {games.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            isFavourite={favourites.includes(g.id)}
            isOfflineCached={offlineIds.includes(g.id)}
            highScore={progressMap[g.id]?.highScore}
            onPlay={launchGame}
            onToggleFavourite={handleToggleFavourite}
            onDownloadOffline={handleDownloadOffline}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#080D1A] dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#080D1A]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <img
              src={LOGO_IMG}
              alt="SC GAMES emblem"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-slate-300 dark:border-slate-700"
            />
            <span>SC GAMES</span>
          </button>

          {/* Zone 2: 5 Concise Single-line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            {[
              { id: 'home', label: 'Home' },
              { id: 'all-games', label: 'All Games' },
              { id: 'kids', label: 'Kids Zone' },
              { id: 'multiplayer', label: 'Multiplayer' },
              { id: 'help', label: 'Help & AI' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id as AppPage)}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-blue-600 dark:hover:text-blue-400 ${
                  page === item.id ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            {!isInstalled ? (
              <button
                onClick={handleInstallAction}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Download className="w-4 h-4" /> Install App
              </button>
            ) : (
              <button
                onClick={() => launchGame(enabledCatalog[0] || INITIAL_GAMES_CATALOG[0])}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Play className="w-4 h-4" /> Quick Play
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1221] px-4 py-3 grid grid-cols-2 gap-2">
            {ZONE_LINKS.map((z) => (
              <button
                key={z.page}
                onClick={() => navigate(z.page)}
                className={`px-3 py-2 rounded-lg text-left text-xs font-semibold ${
                  page === z.page
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Secondary Workspace Bar (Search, Zones, Theme, Audio, Offline indicator) */}
      <div className="border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1221]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            {ZONE_LINKS.slice(3).map((z) => (
              <button
                key={z.page}
                onClick={() => navigate(z.page)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  page === z.page
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 md:flex-initial justify-end">
            <div className="relative flex-1 md:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (page !== 'all-games' && e.target.value.trim()) setPage('all-games');
                }}
                placeholder="Search 26 games..."
                aria-label="Search game library"
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={() =>
                setProfile((p) => ({ ...p, soundEnabled: !p.soundEnabled }))
              }
              aria-label={profile.soundEnabled ? 'Mute audio' : 'Unmute audio'}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            >
              {profile.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() =>
                setProfile((p) => ({
                  ...p,
                  theme: p.theme === 'dark' ? 'light' : 'dark',
                }))
              }
              aria-label={profile.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            >
              {profile.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Offline / SW Update Banner */}
      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Offline Mode Active — Cached games and local progress remain playable.
          <button onClick={() => navigate('offline')} className="underline font-bold">
            Open Offline Games
          </button>
        </div>
      )}

      {swUpdateFn && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-3">
          <span>A new version of SC GAMES is ready.</span>
          <button
            onClick={() => swUpdateFn()}
            className="px-2.5 py-1 rounded bg-white text-blue-700 font-bold inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Update Now
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-12">
        {page === 'home' && (
          <>
            {/* Hero Section (2-column balanced stretch) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  SC – Saipratap Developer · Free-to-Play All-Ages Platform
                </p>
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] sc-headline-balance">
                  Play Together. Enjoy Every Age.
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                  26 original playable games crafted for toddlers with parent guidance, kids, teens, adults, and seniors—available online with friends or cached offline anywhere.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() => launchGame(featuredGames[0] || enabledCatalog[0])}
                    className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm inline-flex items-center gap-2 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" /> Play Featured Game
                  </button>
                  <button
                    onClick={() => navigate('all-games')}
                    className="px-6 py-3 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-900 dark:text-white font-semibold text-sm transition-colors"
                  >
                    Browse 26 Games
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2">
                  <span>Ages 1 to 60+</span>
                  <span aria-hidden="true">·</span>
                  <span>26 Original Modules</span>
                  <span aria-hidden="true">·</span>
                  <span>PWA Installable</span>
                  <span aria-hidden="true">·</span>
                  <span>Child-Safe Kids Zone</span>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="h-full min-h-[260px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#0B1221]">
                  <img
                    src={HERO_IMG}
                    alt="SC GAMES controller, chess pieces, puzzle blocks, and racing track"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </section>

            {/* Age-Group Selector Strip */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Choose Experience by Age Group
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Tailored difficulty, controls, and safety from parent-assisted discovery to senior brain puzzles.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAgeGroup('all')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Show All Ages
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {AGE_GROUPS.map((ag) => {
                  const active = selectedAgeGroup === ag.id;
                  return (
                    <button
                      key={ag.id}
                      onClick={() => setSelectedAgeGroup(active ? 'all' : ag.id)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-500'
                      }`}
                    >
                      <div className="font-bold text-sm">{ag.label}</div>
                      <div className={`text-[11px] mt-1 line-clamp-2 ${active ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {ag.experience}
                      </div>
                    </button>
                  );
                })}
              </div>

              {(selectedAgeGroup === '1-3' || selectedAgeGroup === 'all') && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center gap-3 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    <strong>Parent Guidance Notice:</strong> Children aged 1–3 should only play age-appropriate Kids Zone games with adult supervision. SC GAMES does not encourage independent screen time for infants.
                  </span>
                </div>
              )}

              {selectedAgeGroup !== 'all' && (
                <div className="pt-2 space-y-3">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Recommended for {AGE_GROUPS.find((a) => a.id === selectedAgeGroup)?.label}
                  </h3>
                  {renderGameGrid(filteredGames, 'No games match this filter right now.')}
                </div>
              )}
            </section>

            {/* Zone Spotlights */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div
                onClick={() => navigate('kids')}
                className="cursor-pointer group rounded-2xl overflow-hidden bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 hover:border-amber-500 transition-colors"
              >
                <div className="aspect-[4/3] overflow-hidden bg-amber-100">
                  <img
                    src={KIDS_IMG}
                    alt="Kids Learning Zone toy blocks and shapes"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                </div>
                <div className="p-5">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Ages 1–8 · Ad-Free</p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Kids Learning Zone</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Colors, shapes, animal sounds, alphabet tracing, and counting.
                  </p>
                </div>
              </div>

              <div
                onClick={() => navigate('racing')}
                className="cursor-pointer group rounded-2xl overflow-hidden bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors"
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-900">
                  <img
                    src={RACING_IMG}
                    alt="Racing Zone miniature sports car on circuit"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                </div>
                <div className="p-5">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Touch + Keyboard</p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Racing & Driving Zone</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Turbo GP, endless highway, precision parking, bike sprint, and traffic dodge.
                  </p>
                </div>
              </div>

              <div
                onClick={() => navigate('brain')}
                className="cursor-pointer group rounded-2xl overflow-hidden bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 hover:border-purple-500 transition-colors"
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-900">
                  <img
                    src={BRAIN_ARCADE_IMG}
                    alt="Chessboard, puzzle cube, and arcade tokens"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                </div>
                <div className="p-5">
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">All Ages & Seniors</p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Brain, Chess & Arcade</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Chess Master, Sudoku, Senior Word Search with hints, and classic arcade.
                  </p>
                </div>
              </div>
            </section>

            {/* Featured Games */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Featured Games</h2>
                <button
                  onClick={() => navigate('all-games')}
                  className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View All {enabledCatalog.length} Games
                </button>
              </div>
              {renderGameGrid(featuredGames, 'No featured games selected.')}
            </section>

            {/* Recently Played & Popular */}
            {recentGames.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recently Played</h2>
                  <button
                    onClick={() => navigate('my-games')}
                    className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    My Progress
                  </button>
                </div>
                {renderGameGrid(recentGames.slice(0, 3), 'Play any game to build your recent history.')}
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Popular Across All Ages</h2>
              {renderGameGrid(popularGames, 'No popular games available.')}
            </section>

            {/* General Sponsor Banner (Strictly disabled inside Kids Zone!) */}
            {adHomeBanner && !profile.parentLockKidsSafe && (
              <section className="p-6 rounded-2xl bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium">SC GAMES Publishing & Sponsorship Slot</p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    Built Free-to-Play on Web & PWA — Zero Paywalls on Core Gameplay
                  </h3>
                </div>
                <button
                  onClick={() => navigate('help')}
                  className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
                >
                  Partner or Sponsor
                </button>
              </section>
            )}
          </>
        )}

        {/* All Games Searchable Library */}
        {page === 'all-games' && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Complete Game Library</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {filteredGames.length} playable original games across 6 categories.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'kids', 'brain', 'racing', 'arcade', 'sports', 'family'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      categoryFilter === cat
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
            {renderGameGrid(filteredGames, 'No games match your search query.')}
          </section>
        )}

        {/* Dedicated Category Zones */}
        {(['kids', 'brain', 'racing', 'arcade', 'sports', 'family'] as const).includes(
          page as GameMetadata['category']
        ) && (
          <section className="space-y-6">
            <div
              className={`p-6 rounded-2xl border ${
                page === 'kids'
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                  : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800'
              }`}
            >
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {CATEGORY_LABELS[page as GameMetadata['category']]}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {page === 'kids'
                  ? 'Parent-assisted, ad-free educational games for young explorers. Zero external links or open chat.'
                  : `Original ${CATEGORY_LABELS[page as GameMetadata['category']]} modules built for touch and desktop play.`}
              </p>
            </div>
            {renderGameGrid(
              enabledCatalog.filter((g) => g.category === page),
              'No games currently enabled in this zone.'
            )}
          </section>
        )}

        {/* Multiplayer Page */}
        {page === 'multiplayer' && (
          <MultiplayerArena playerName={profile.name} isOnline={isOnline} />
        )}

        {/* Offline Games Page */}
        {page === 'offline' && (
          <section className="space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Offline Games Vault</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Downloaded games work without internet using PWA Service Worker + IndexedDB storage. ({offlineIds.length} cached)
                </p>
              </div>
              <button
                onClick={async () => {
                  for (const g of enabledCatalog.filter((x) => x.offlineCompatible)) {
                    await handleDownloadOffline(g.id, g.version);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Cache All Offline Games
              </button>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cached Ready-to-Play Offline</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {enabledCatalog
                  .filter((g) => offlineIds.includes(g.id))
                  .map((g) => (
                    <div key={g.id} className="space-y-2">
                      <GameCard
                        game={g}
                        isFavourite={favourites.includes(g.id)}
                        isOfflineCached={true}
                        highScore={progressMap[g.id]?.highScore}
                        onPlay={launchGame}
                        onToggleFavourite={handleToggleFavourite}
                        onDownloadOffline={handleDownloadOffline}
                      />
                      <button
                        onClick={() => setOfflineIds(removeOfflineGame(g.id))}
                        className="text-xs text-slate-500 hover:text-rose-500 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove from offline cache
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* My Games (Favourites & Saved Progress) */}
        {page === 'my-games' && (
          <section className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                <Heart className="w-6 h-6 text-rose-500" /> My Favourite Games
              </h1>
              {renderGameGrid(
                enabledCatalog.filter((g) => favourites.includes(g.id)),
                'Tap the heart icon on any game card to save favourites here.'
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Saved High Scores & History
              </h2>
              {Object.keys(progressMap).length === 0 ? (
                <p className="text-sm text-slate-500">Play any game to record high scores locally.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.values(progressMap).map((prog) => {
                    const meta = catalog.find((g) => g.id === prog.gameId);
                    if (!meta) return null;
                    return (
                      <div
                        key={prog.gameId}
                        className="p-4 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{meta.title}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            Best: {prog.highScore} · Plays: {prog.plays}
                          </p>
                        </div>
                        <button
                          onClick={() => launchGame(meta)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                        >
                          Play
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Profile & Parental Controls */}
        {page === 'profile' && (
          <section className="max-w-2xl mx-auto space-y-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-5">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                Player Profile & Parent Controls
              </h1>

              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Display Nickname (for Leaderboards & Rooms)
                  </label>
                  <input
                    value={profile.name}
                    maxLength={24}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value || 'Player' }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Kids-Only Parent Filter</div>
                    <div className="text-xs text-slate-500">Restrict visible library strictly to supervised Kids Zone games</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.parentLockKidsSafe}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, parentLockKidsSafe: e.target.checked }))
                    }
                    className="w-5 h-5 accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Synthesized Game Audio FX</div>
                    <div className="text-xs text-slate-500">Toggle Web Audio sound effects across all games</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.soundEnabled}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, soundEnabled: e.target.checked }))
                    }
                    className="w-5 h-5 accent-blue-600"
                  />
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" /> Unlocked Achievements
                </h2>
                {profile.achievements.length === 0 ? (
                  <p className="text-xs text-slate-500">Complete games to earn achievements.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {profile.achievements.map((a) => (
                      <span
                        key={a}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={async () => {
                    await clearAllLocalGameData();
                    setProgressMap({});
                    setFavourites([]);
                    setRecentIds([]);
                    setOfflineIds([]);
                    setErrorLogs([]);
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset Local Progress & Offline Cache
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Admin Dashboard */}
        {page === 'admin' && (
          <AdminDashboardView catalog={catalog} onOverridesUpdated={fetchCatalogOverrides} />
        )}

        {/* Help Centre & SC AI Game Doctor */}
        {page === 'help' && (
          <HelpAndDoctorView
            catalog={catalog}
            errorLogs={errorLogs}
            onUpdateErrorLogs={setErrorLogs}
            prefilledGameId={reportTargetGame}
          />
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1221] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <strong className="text-slate-900 dark:text-white">SC GAMES</strong> · Saipratap Developer · Play Together. Enjoy Every Age.
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={() => navigate('offline')} className="hover:text-blue-500">Offline Vault</button>
            <button onClick={() => navigate('help')} className="hover:text-blue-500">SC AI Game Doctor</button>
            <button onClick={() => navigate('admin')} className="hover:text-blue-500">Admin Console</button>
            <button onClick={() => navigate('help')} className="hover:text-blue-500">Privacy & Child Safety</button>
          </div>
        </div>
      </footer>

      {/* Active Game Arena Modal */}
      {activeGame && (
        <GameStageModal
          game={activeGame}
          isFavourite={favourites.includes(activeGame.id)}
          isOfflineCached={offlineIds.includes(activeGame.id)}
          soundEnabled={profile.soundEnabled}
          playerName={profile.name}
          onClose={() => setActiveGame(null)}
          onToggleFavourite={handleToggleFavourite}
          onDownloadOffline={handleDownloadOffline}
          onToggleSound={() =>
            setProfile((p) => ({ ...p, soundEnabled: !p.soundEnabled }))
          }
          onRecordScore={handleRecordScore}
          onOpenReportModal={(gid) => {
            setActiveGame(null);
            setReportTargetGame(gid);
            navigate('help');
          }}
        />
      )}

      {/* Install PWA Instructions Modal */}
      {showInstallModal && (
        <InstallModal
          canNativePrompt={canNativePrompt}
          isIOS={isIOS}
          onNativeInstall={async () => {
            await triggerInstall();
            setShowInstallModal(false);
          }}
          onClose={() => setShowInstallModal(false)}
        />
      )}
    </div>
  );
}
