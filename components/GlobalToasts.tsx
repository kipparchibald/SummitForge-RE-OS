'use client';

import ToastViewport from '@/components/ui/ToastViewport';

/** Mount once in root layout for app-wide toasts. */
export default function GlobalToasts() {
  return <ToastViewport />;
}
