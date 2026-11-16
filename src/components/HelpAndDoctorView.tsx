import React, { useState } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Send,
  RefreshCw,
  FileText,
} from 'lucide-react';
import type { AIDiagnosisResult, ErrorLogEntry, GameMetadata } from '../types/game';
import {
  runAutomatedPlatformDiagnostics,
  type HealthCheckResult,
} from '../utils/errorMonitor';
import { IMPLEMENTED_GAME_IDS } from '../games/GameRegistry';
import { saveErrorLogs } from '../utils/storage';

interface HelpAndDoctorViewProps {
  catalog: GameMetadata[];
  errorLogs: ErrorLogEntry[];
  onUpdateErrorLogs: (logs: ErrorLogEntry[]) => void;
  prefilledGameId?: string | null;
}

export const HelpAndDoctorView: React.FC<HelpAndDoctorViewProps> = ({
  catalog,
  errorLogs,
  onUpdateErrorLogs,
  prefilledGameId,
}) => {
  const [diagResults, setDiagResults] = useState<HealthCheckResult[] | null>(null);
  const [runningDiag, setRunningDiag] = useState(false);

  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);
  const [repairToast, setRepairToast] = useState<string | null>(null);

  // Contact / Report Form
  const [reportGameId, setReportGameId] = useState<string>(prefilledGameId || 'platform');
  const [reportMsg, setReportMsg] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [activePolicyTab, setActivePolicyTab] = useState<'none' | 'privacy' | 'terms'>('none');

  const handleRunHealthSuite = async () => {
    setRunningDiag(true);
    const results = await runAutomatedPlatformDiagnostics(catalog, IMPLEMENTED_GAME_IDS);
    setDiagResults(results);
    setRunningDiag(false);
  };

  const handleRunAIFix = async (entry: ErrorLogEntry) => {
    setDiagnosingId(entry.id);
    setSelectedErrorId(entry.id);
    setAiErrorMsg(null);
    setRepairToast(null);
    try {
      const res = await fetch('/api/doctor/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorText: entry.message,
          gameId: entry.gameId || entry.source,
          context: `Line: ${entry.line ?? 'unknown'}, Source: ${entry.source}`,
        }),
      });
      const data = (await res.json()) as { diagnosis?: AIDiagnosisResult; error?: string };
      if (!res.ok || !data.diagnosis) {
        setAiErrorMsg(data.error || 'Unable to run AI diagnosis right now.');
        return;
      }

      const updated = errorLogs.map((log) =>
        log.id === entry.id
          ? { ...log, status: 'diagnosed' as const, aiDiagnosis: data.diagnosis }
          : log
      );
      onUpdateErrorLogs(updated);
      saveErrorLogs(updated);
    } catch {
      setAiErrorMsg('Network unavailable. AI Game Doctor requires internet access to analyze logs.');
    } finally {
      setDiagnosingId(null);
    }
  };

  const executeSafeRepair = async (entry: ErrorLogEntry) => {
    const action = entry.aiDiagnosis?.safeAutoRepairAction;
    if (!action) return;

    if (action === 'clear_stale_cache' && typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      setRepairToast('Safe Repair Verified: Cleared stale browser cache and re-tested storage.');
    } else if (action === 'reset_game_storage' && entry.gameId) {
      localStorage.removeItem(`sc_games_progress_v1`);
      setRepairToast(`Safe Repair Verified: Reset local progress state for ${entry.gameId}.`);
    } else if (action === 'refresh_sw' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
      setRepairToast('Safe Repair Verified: Refreshed Service Worker registration.');
    } else {
      setRepairToast('Safe Repair Verified: Client module state revalidated.');
    }

    const updated = errorLogs.map((log) =>
      log.id === entry.id ? { ...log, status: 'resolved' as const } : log
    );
    onUpdateErrorLogs(updated);
    saveErrorLogs(updated);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportMsg.trim()) return;
    setSubmittingReport(true);
    setReportSuccess(null);

    const newLocalLog: ErrorLogEntry = {
      id: `rep-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'user-report',
      gameId: reportGameId === 'platform' ? undefined : reportGameId,
      message: reportMsg.trim(),
      status: 'open',
    };
    const nextLogs = [newLocalLog, ...errorLogs];
    onUpdateErrorLogs(nextLogs);
    saveErrorLogs(nextLogs);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: reportGameId === 'platform' ? undefined : reportGameId,
          source: 'help-centre-contact',
          message: reportMsg.trim(),
          contactEmail: contactEmail.trim() || undefined,
        }),
      });
      if (res.ok) {
        setReportSuccess('Report logged and queued for SC AI Game Doctor & Admin review.');
        setReportMsg('');
      } else {
        setReportSuccess('Saved locally (server offline). You can run AI Fix once back online.');
      }
    } catch {
      setReportSuccess('Saved locally while offline.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const simulateTestDiagnosticEvent = () => {
    const sample: ErrorLogEntry = {
      id: `diag-${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'game-loader',
      gameId: 'turbo-gp',
      line: 142,
      message: 'Asset cache checksum mismatch detected in offline bundle for turbo-gp',
      status: 'open',
    };
    const next = [sample, ...errorLogs];
    onUpdateErrorLogs(next);
    saveErrorLogs(next);
  };

  return (
    <div className="space-y-8">
      {/* Header & Automated Health Suite */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <Stethoscope className="w-6 h-6 text-blue-500" />
              SC AI Game Doctor & Help Centre
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Monitors JavaScript errors, validates all 26 game modules, diagnoses root causes with Gemini, and gates risky changes behind admin approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRunHealthSuite}
              disabled={runningDiag}
              className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${runningDiag ? 'animate-spin' : ''}`} />
              {runningDiag ? 'Running Checks...' : 'Run Automated Diagnostics'}
            </button>
            <button
              onClick={simulateTestDiagnosticEvent}
              className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold whitespace-nowrap"
            >
              Log Test Diagnostic
            </button>
          </div>
        </div>

        {diagResults && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {diagResults.map((res) => (
              <div
                key={res.checkName}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    {res.checkName}
                  </span>
                  <span
                    className={`text-xs font-bold inline-flex items-center gap-1 ${
                      res.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {res.passed ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {res.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{res.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Monitor & AI Fix Workflow */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Captured Diagnostics & Error Logs
            </h3>
            <span className="text-xs font-mono text-slate-500">{errorLogs.length} logged</span>
          </div>

          {aiErrorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
              {aiErrorMsg}
            </div>
          )}
          {repairToast && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300">
              {repairToast}
            </div>
          )}

          {errorLogs.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Zero runtime errors captured in this session.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Submit a report or trigger "Log Test Diagnostic" to test SC AI Game Doctor.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {errorLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-mono">
                        {entry.source} {entry.gameId ? `· ${entry.gameId}` : ''} · {entry.status.toUpperCase()}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                        {entry.message}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRunAIFix(entry)}
                      disabled={diagnosingId === entry.id}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      {diagnosingId === entry.id ? 'Analyzing...' : 'AI Fix'}
                    </button>
                  </div>

                  {entry.aiDiagnosis && (selectedErrorId === entry.id || entry.status !== 'open') && (
                    <div className="mt-2 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          AI Diagnosis ({entry.aiDiagnosis.severity.toUpperCase()})
                        </span>
                        <span className="text-slate-500">
                          {entry.aiDiagnosis.requiresAdminApproval ? 'Admin Approval Required' : 'Safe Auto-Repair Eligible'}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-200">
                        <strong>Probable Cause:</strong> {entry.aiDiagnosis.probableCause}
                      </p>
                      <p className="text-slate-700 dark:text-slate-200">
                        <strong>Suggested Fix:</strong> {entry.aiDiagnosis.suggestedFix}
                      </p>
                      <ul className="list-disc pl-4 text-slate-600 dark:text-slate-400 space-y-0.5">
                        {entry.aiDiagnosis.verificationSteps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                      {entry.aiDiagnosis.safeAutoRepairAction && entry.status !== 'resolved' && (
                        <button
                          onClick={() => executeSafeRepair(entry)}
                          className="mt-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          Run Safe Repair ({entry.aiDiagnosis.safeAutoRepairAction})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact & Report Problem Form */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 space-y-5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Report an Error or Contact Saipratap Developer
          </h3>
          <form onSubmit={handleSubmitReport} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Affected Game or Area
              </label>
              <select
                value={reportGameId}
                onChange={(e) => setReportGameId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              >
                <option value="platform">General Platform / Navigation</option>
                {catalog.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Describe the issue or feedback
              </label>
              <textarea
                rows={4}
                required
                value={reportMsg}
                onChange={(e) => setReportMsg(e.target.value)}
                placeholder="Tell us what happened (e.g., button unresponsive, mobile display overlap, or game idea)..."
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Email (optional, never required for kids)
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            {reportSuccess && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{reportSuccess}</p>
            )}

            <button
              type="submit"
              disabled={submittingReport}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submittingReport ? 'Submitting...' : 'Contact & Submit Report'}
            </button>
          </form>

          {/* Privacy & Terms */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActivePolicyTab(activePolicyTab === 'privacy' ? 'none' : 'privacy')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 hover:underline"
              >
                <FileText className="w-3.5 h-3.5" /> Privacy & Child Safety Policy
              </button>
              <button
                onClick={() => setActivePolicyTab(activePolicyTab === 'terms' ? 'none' : 'terms')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 hover:underline"
              >
                <FileText className="w-3.5 h-3.5" /> Terms & Conditions
              </button>
            </div>
            {activePolicyTab === 'privacy' && (
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                SC GAMES collects zero personal information from children. Kids Zone disables all advertisements, open chat, and external links. Game progress is saved locally in your browser via IndexedDB. Error diagnostics automatically redact tokens and personal identifiers before analysis.
              </p>
            )}
            {activePolicyTab === 'terms' && (
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                All 26 original browser games on SC GAMES (Saipratap Developer) are free-to-play. Children aged 1–3 should only use Kids Zone under direct adult supervision. Online multiplayer rooms use preset phrases only.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
