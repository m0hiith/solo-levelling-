import { AnimatePresence, m } from 'motion/react';
import { Check, X } from 'lucide-react';
import { AlertToast } from '../hooks/useAlertEngine';
import { REMINDER_ICONS } from '../lib/icons';

interface ToastsProps {
  toasts: AlertToast[];
  onDismiss: (id: string) => void;
  onAcknowledge: (toast: AlertToast) => void;
}

/**
 * In-app System alerts.
 *
 * These render regardless of notification permission, so an alert is never lost just
 * because the browser said no — and on a phone with the HUD open they read better
 * than the OS banner anyway.
 */
export function Toasts({ toasts, onDismiss, onAcknowledge }: ToastsProps) {
  return (
    <div
      className="fixed z-[200] bottom-28 lg:bottom-6 right-4 left-4 lg:left-auto lg:w-96 flex flex-col gap-3 pointer-events-none"
      role="region"
      aria-live="polite"
      aria-label="System alerts"
    >
      <AnimatePresence>
        {toasts.map(toast => {
          const meta = REMINDER_ICONS[toast.icon];
          const Icon = meta.icon;
          const done = toast.trackCount && toast.count >= toast.target;

          return (
            <m.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="pointer-events-auto bg-neutral-950/95 backdrop-blur-xl border border-primary/30 border-l-2 border-l-primary p-4 shadow-[0_0_30px_rgba(237,177,255,0.15)]"
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${meta.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-headline font-bold text-[10px] tracking-[0.2em] uppercase text-primary truncate">
                      {toast.title}
                    </p>
                    <button
                      onClick={() => onDismiss(toast.id)}
                      aria-label="Dismiss alert"
                      className="text-outline hover:text-on-surface transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-on-surface leading-snug">{toast.body}</p>

                  {toast.trackCount && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-1 bg-white/5">
                        <div
                          className="h-full bg-secondary transition-all duration-500"
                          style={{
                            width: `${Math.min(100, (toast.count / Math.max(1, toast.target)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="font-headline text-[10px] tracking-widest text-outline shrink-0">
                        {toast.count} / {toast.target}
                      </span>
                      <button
                        onClick={() => onAcknowledge(toast)}
                        disabled={done}
                        className="flex items-center gap-1 bg-secondary text-background px-3 py-1.5 font-headline font-bold text-[9px] uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40 shrink-0"
                      >
                        <Check className="w-3 h-3" />
                        {done ? 'Done' : 'Log it'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
