/**
 * Idaho-style transaction checklist templates.
 * Days are offsets from under-contract effective date (typical Eastern Idaho practice).
 * Agent should confirm against the actual RE-21 dates.
 */

import type { Transaction } from './coordinator';

export type ChecklistItem = {
  id: string;
  stage: Transaction['status'];
  title: string;
  /** Business days after effective date when this typically comes due */
  dueDayOffset?: number;
  owner: 'buyer' | 'seller' | 'agent' | 'lender' | 'title' | 'shared';
  done?: boolean;
  notes?: string;
};

/** Standard residential purchase checklist (Idaho RE-21 cadence). */
export function buildResidentialChecklist(opts?: {
  effectiveDate?: string;
  isNewConstruction?: boolean;
  isLand?: boolean;
}): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      id: 'uc_notify',
      stage: 'under_contract',
      title: 'Notify all parties under contract; calendar key dates',
      dueDayOffset: 0,
      owner: 'agent',
    },
    {
      id: 'uc_earnest',
      stage: 'under_contract',
      title: 'Earnest money delivered to title / brokerage trust',
      dueDayOffset: 3,
      owner: 'buyer',
    },
    {
      id: 'insp_order',
      stage: 'inspection',
      title: 'Order home inspection (and well/septic if applicable)',
      dueDayOffset: 1,
      owner: 'buyer',
    },
    {
      id: 'insp_complete',
      stage: 'inspection',
      title: 'Inspection contingency deadline',
      dueDayOffset: 10,
      owner: 'buyer',
    },
    {
      id: 'insp_repair',
      stage: 'inspection',
      title: 'Repair / credit negotiations complete',
      dueDayOffset: 14,
      owner: 'shared',
    },
    {
      id: 'appr_order',
      stage: 'appraisal',
      title: 'Lender orders appraisal',
      dueDayOffset: 7,
      owner: 'lender',
    },
    {
      id: 'appr_clear',
      stage: 'appraisal',
      title: 'Appraisal received and value supports loan',
      dueDayOffset: 21,
      owner: 'lender',
    },
    {
      id: 'lend_docs',
      stage: 'lending',
      title: 'Buyer returns all lender conditions',
      dueDayOffset: 18,
      owner: 'buyer',
    },
    {
      id: 'lend_ctc',
      stage: 'lending',
      title: 'Clear to close from lender',
      dueDayOffset: 28,
      owner: 'lender',
    },
    {
      id: 'title_open',
      stage: 'title',
      title: 'Open title / escrow; order commitment',
      dueDayOffset: 2,
      owner: 'title',
    },
    {
      id: 'title_review',
      stage: 'title',
      title: 'Review title commitment; resolve exceptions',
      dueDayOffset: 20,
      owner: 'shared',
    },
    {
      id: 'close_cd',
      stage: 'closing',
      title: 'Closing disclosure received (TRID timing)',
      dueDayOffset: 25,
      owner: 'lender',
    },
    {
      id: 'close_walk',
      stage: 'closing',
      title: 'Final walk-through',
      dueDayOffset: 29,
      owner: 'buyer',
    },
    {
      id: 'close_sign',
      stage: 'closing',
      title: 'Sign closing docs; funds wired to title only',
      dueDayOffset: 30,
      owner: 'shared',
    },
    {
      id: 'closed_keys',
      stage: 'closed',
      title: 'Keys / possession; record confirmation',
      dueDayOffset: 30,
      owner: 'agent',
    },
  ];

  if (opts?.isLand) {
    items.push(
      {
        id: 'land_survey',
        stage: 'inspection',
        title: 'Survey / boundary confirmation if required',
        dueDayOffset: 15,
        owner: 'buyer',
      },
      {
        id: 'land_water',
        stage: 'inspection',
        title: 'Water rights / shares verified',
        dueDayOffset: 12,
        owner: 'buyer',
      }
    );
  }

  if (opts?.isNewConstruction) {
    items.push({
      id: 'nc_warranty',
      stage: 'closing',
      title: 'Builder warranty package delivered',
      dueDayOffset: 30,
      owner: 'seller',
    });
  }

  return items;
}

export function dueDateIso(effectiveDate: string, dayOffset: number): string {
  const d = new Date(effectiveDate);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

export function checklistForStage(
  items: ChecklistItem[],
  stage: Transaction['status']
): ChecklistItem[] {
  const order: Transaction['status'][] = [
    'new',
    'under_contract',
    'inspection',
    'appraisal',
    'lending',
    'title',
    'closing',
    'closed',
  ];
  const idx = order.indexOf(stage);
  // Show current stage + prior incomplete
  return items.filter((it) => {
    const si = order.indexOf(it.stage);
    if (si === idx) return true;
    if (si < idx && !it.done) return true;
    return false;
  });
}
