import React, { useEffect, useState } from 'react';
import { Lock, LogOut, RotateCcw, Shield, BarChart3, DollarSign, CheckCircle2 } from 'lucide-react';
import type { ErrorLogEntry, GameMetadata } from '../types/game';

interface AdminDashboardViewProps {
  catalog: GameMetadata[];
  onOverridesUpdated: () => void;
}

interface AnalyticsPayload {
  totalVisits: number;
  totalPlays: number;
  gamePlays: Record<string, number>;
  openReports: number;
  adConfig: {
    homeBannerEnabled: boolean;
    sidebarSponsorEnabled: boolean;
    kidsZoneAdsAllowed: false;
    monthlyEstimatedRpmInr: number;
  };
}

interface SnapshotItem {
  id: string;
  createdAt: string;
  note: string;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  catalog,
  onOverridesUpdated,
}) => {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('sc_admin_token') || '');
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [reports, setReports] = useState<ErrorLogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [monetizedSessions, setMonetizedSessions] = useState(40000);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchAdminData = async (activeToken: string) => {
    try {
      const [anRes, repRes, snapRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/reports'),
        fetch('/api/admin/snapshots', { headers: { Authorization: `Bearer ${activeToken}` } }),
      ]);
      if (anRes.ok) setAnalytics((await anRes.json()) as AnalyticsPayload);
      if (repRes.ok) {
        const d = (await repRes.json()) as { reports: ErrorLogEntry[] };
        setReports(d.reports || []);
      }
      if (snapRes.ok) {
        const s = (await snapRes.json()) as { snapshots: SnapshotItem[] };
        setSnapshots(s.snapshots || []);
      }
    } catch {
      // Offline
    }
  };

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch('/api/admin/session', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as { authenticated?: boolean };
        if (data.authenticated) {
          void fetchAdminData(token);
        } else {
          sessionStorage.removeItem('sc_admin_token');
          setToken('');
        }
      } catch {
        // Ignore
      }
    })();
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      sessionStorage.setItem('sc_admin_token', data.token);
      setToken(data.token);
      setPasscode('');
    } catch {
      setAuthError('Server unreachable.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sc_admin_token');
    setToken('');
  };

  const patchGame = async (gameId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/games/${encodeURIComponent(gameId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setStatusMsg(`Updated ${gameId} and created rollback snapshot.`);
      onOverridesUpdated();
      void fetchAdminData(token);
    }
  };

  const patchAds = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/ads', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setStatusMsg('Updated advertising & child-safety policy settings.');
      onOverridesUpdated();
      void fetchAdminData(token);
    }
  };

  const resolveReport = async (id: string) => {
    const res = await fetch(`/api/admin/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'resolved' }),
    });
    if (res.ok) void fetchAdminData(token);
  };

  const triggerRollback = async (snapshotId?: string) => {
    const res = await fetch('/api/admin/rollback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ snapshotId }),
    });
    if (res.ok) {
      setStatusMsg('Rolled back catalog overrides to previous verified snapshot.');
      onOverridesUpdated();
      void fetchAdminData(token);
    }
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto p-8 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h2>
            <p className="text-xs text-slate-500">Protected by server-side role authentication</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Administrator Passcode
            </label>
            <input
              type="password"
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter server ADMIN_PASSCODE"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            />
          </div>
          {authError && <p className="text-xs text-rose-500 font-medium">{authError}</p>}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
          >
            {loggingIn ? 'Verifying...' : 'Sign In to Admin Console'}
          </button>
        </form>
        <p className="text-xs text-slate-500 leading-relaxed">
          Administrator credentials are verified exclusively on the backend (`/api/admin/login`) using `process.env.ADMIN_PASSCODE` (default development passcode: `SC-ADMIN-2026`).
        </p>
      </div>
    );
  }

  const rpm = analytics?.adConfig.monthlyEstimatedRpmInr ?? 100;
  const illustrativeRevenue = Math.round((monetizedSessions / 1000) * rpm);
  const topGames = Object.entries(analytics?.gamePlays || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            Platform Admin Control Center
          </h2>
          <p className="text-xs text-slate-500">
            Manage 26 game modules, offline compatibility, analytics, child-safe ads, and rollback snapshots.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerRollback()}
            disabled={snapshots.length === 0}
            className="px-3 py-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Rollback Last Change
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {statusMsg}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Total Platform Visits</p>
          <p className="text-2xl font-mono font-bold text-slate-900 dark:text-white mt-1">
            {(analytics?.totalVisits ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Total Game Plays</p>
          <p className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
            {(analytics?.totalPlays ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Active Modules</p>
          <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {catalog.filter((g) => g.enabled).length} / {catalog.length}
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Open Error Reports</p>
          <p className="text-2xl font-mono font-bold text-amber-500 mt-1">
            {reports.filter((r) => r.status === 'open').length}
          </p>
        </div>
      </div>

      {/* Popular Games & Monetization Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" /> Top Played Games
          </h3>
          <div className="space-y-2">
            {topGames.map(([id, plays]) => (
              <div key={id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {catalog.find((g) => g.id === id)?.title || id}
                </span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{plays.toLocaleString()} plays</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" /> Advertising & Illustrative Revenue Planner
          </h3>
          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">Adult/General Home Sponsor Slot</span>
              <input
                type="checkbox"
                checked={Boolean(analytics?.adConfig.homeBannerEnabled)}
                onChange={(e) => patchAds({ homeBannerEnabled: e.target.checked })}
                className="w-4 h-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between opacity-75">
              <span className="text-slate-700 dark:text-slate-300">Kids Zone Ads (Locked Off — Child Safety)</span>
              <input type="checkbox" checked={false} disabled className="w-4 h-4" />
            </label>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Monetized Monthly Sessions</span>
              <input
                type="number"
                value={monetizedSessions}
                onChange={(e) => setMonetizedSessions(Math.max(0, Number(e.target.value)))}
                className="w-28 px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-right"
              />
            </div>
            <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
              <span>Illustrative Estimate (₹{rpm} / 1,000 sessions)</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                ₹{illustrativeRevenue.toLocaleString()} / mo
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Illustrative model only; not a forecast. Actual earnings depend on traffic eligibility and AdSense/network policy approval.
            </p>
          </div>
        </div>
      </div>

      {/* Game Catalog Management Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4">Game Catalog & Version Control</h3>
        <table className="w-full text-left text-xs border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <th className="py-2 pr-4">Game</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3">Version</th>
              <th className="py-2 px-3">Offline Ready</th>
              <th className="py-2 px-3">Featured</th>
              <th className="py-2 pl-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((g) => (
              <tr key={g.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                <td className="py-2.5 pr-4 font-semibold text-slate-900 dark:text-white">{g.title}</td>
                <td className="py-2.5 px-3 capitalize text-slate-600 dark:text-slate-400">{g.category}</td>
                <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">v{g.version}</td>
                <td className="py-2.5 px-3">
                  <button
                    onClick={() => patchGame(g.id, { offlineCompatible: !g.offlineCompatible })}
                    className={`px-2 py-1 rounded text-[11px] font-semibold ${
                      g.offlineCompatible ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {g.offlineCompatible ? 'Yes' : 'Online Only'}
                  </button>
                </td>
                <td className="py-2.5 px-3">
                  <button
                    onClick={() => patchGame(g.id, { featured: !g.featured })}
                    className={`px-2 py-1 rounded text-[11px] font-semibold ${
                      g.featured ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {g.featured ? 'Featured' : 'Standard'}
                  </button>
                </td>
                <td className="py-2.5 pl-3 text-right">
                  <button
                    onClick={() => patchGame(g.id, { enabled: !g.enabled })}
                    className={`px-3 py-1 rounded font-semibold ${
                      g.enabled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {g.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Reports Queue */}
      {reports.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Submitted Reports & Issues</h3>
          {reports.slice(0, 10).map((rep) => (
            <div key={rep.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{rep.message}</p>
                <p className="text-slate-500 font-mono">
                  {rep.gameId || 'platform'} · {rep.status.toUpperCase()} · {new Date(rep.timestamp).toLocaleString()}
                </p>
              </div>
              {rep.status !== 'resolved' && (
                <button
                  onClick={() => resolveReport(rep.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
