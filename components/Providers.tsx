'use client';

import React from 'react';
import ToastViewport from '@/components/ui/ToastViewport';

/** Global client providers — toasts. Wrap page content or mount alone. */
export default function Providers({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
