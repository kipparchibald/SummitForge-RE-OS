/**
 * Lightweight toast store — no external deps.
 * Works client-side via subscribers + optional CustomEvent for multi-tab noise.
 */

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  createdAt: number;
  durationMs: number;
};

type Listener = (items: ToastItem[]) => void;

const listeners = new Set<Listener>();
let items: ToastItem[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function notify() {
  listeners.forEach((l) => {
    try {
      l([...items]);
    } catch {
      /* */
    }
  });
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...items]);
  return () => listeners.delete(listener);
}

export function dismissToast(id: string) {
  items = items.filter((t) => t.id !== id);
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
  notify();
}

export function toast(
  message: string,
  opts?: { tone?: ToastTone; durationMs?: number }
): string {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const durationMs = opts?.durationMs ?? 3200;
  const item: ToastItem = {
    id,
    message,
    tone: opts?.tone ?? 'info',
    createdAt: Date.now(),
    durationMs,
  };
  items = [item, ...items].slice(0, 5);
  notify();

  if (typeof window !== 'undefined' && durationMs > 0) {
    const timer = setTimeout(() => dismissToast(id), durationMs);
    timers.set(id, timer);
  }
  return id;
}

export const toastSuccess = (msg: string) => toast(msg, { tone: 'success' });
export const toastError = (msg: string) => toast(msg, { tone: 'error', durationMs: 4500 });
export const toastWarning = (msg: string) => toast(msg, { tone: 'warning' });
export const toastInfo = (msg: string) => toast(msg, { tone: 'info' });
