'use client';

import React from 'react';
import SystemHealthStrip from '@/components/SystemHealthStrip';

/** Drop-in health/realtime strip for the agent dashboard. */
export default function DashboardHealthBar() {
  return (
    <div className="w-full">
      <SystemHealthStrip showLink={false} />
    </div>
  );
}
