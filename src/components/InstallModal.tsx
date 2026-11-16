import React from 'react';
import { Smartphone, Monitor, Download, X } from 'lucide-react';

interface InstallModalProps {
  canNativePrompt: boolean;
  isIOS: boolean;
  onNativeInstall: () => Promise<void>;
  onClose: () => void;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  canNativePrompt,
  isIOS,
  onNativeInstall,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Install SC GAMES App"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Install SC GAMES App</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Play offline in a dedicated window on mobile and desktop.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close install instructions"
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {canNativePrompt ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Your browser supports direct PWA installation. Tap below to add SC GAMES to your device.
            </p>
            <button
              onClick={onNativeInstall}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm inline-flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Install SC GAMES Now
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-500" />
                {isIOS ? 'iPhone & iPad (Safari)' : 'Android & Mobile Browsers'}
              </div>
              {isIOS ? (
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  1. Tap the <strong>Share</strong> icon in Safari.<br />
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.
                </p>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Open the browser menu (⋮) and tap <strong>Install App</strong> or <strong>Add to Home screen</strong>.
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-purple-500" />
                Windows & macOS Desktop
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Click the install icon in the address bar of Chrome, Edge, or Safari (File → Add to Dock) to launch SC GAMES as a standalone desktop app.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
};
