'use client';

import React from 'react';
import SystemHealthStrip from '@/components/SystemHealthStrip';
import ToastViewport from '@/components/ui/ToastViewport';

/** Drop-in health/realtime strip for the agent dashboard + global toasts. */
export default function DashboardHealthBar() {
  return (
    <>
      <div className="w-full">
        <SystemHealthStrip showLink={false} />
      </div>
      <ToastViewport />
    </>
  );
}
