import type { NurtureSequence } from '@/lib/nurture/sequences';

export const PREDICTIVE_SEQUENCES: NurtureSequence[] = [
  {
    id: 'lot-buyer-teton',
    name: 'Teton Heights / lot buyer',
    description: 'Lot and well/septic education drip for Division 6 buyers',
    triggerStage: 'qualified',
    steps: [
      { dayOffset: 0, channel: 'sms', body: 'Hi {{firstName}} — {{agent}} at Archibald-Bagley. Teton Heights lots are well + septic, with gas/power/fiber at the lot. Want the one-pager and current available lots?' },
      { dayOffset: 3, channel: 'sms', body: '{{firstName}}, builders can use our volume notes on Division 6. Reply LOTS and I will send what is still open under {{budget}}.' },
      { dayOffset: 10, channel: 'email', subject: 'Teton Heights — what is already in the street', body: 'Hi {{name}},\n\nGas, power (transformer set), and fiber are to the lots. You still budget well, septic, and the house.\n\n— {{agent}}' },
    ],
  },
  {
    id: 'new-construction-buyer',
    name: 'New construction buyer',
    description: 'Spec / custom path in Rigby and Jefferson County',
    triggerStage: 'qualified',
    steps: [
      { dayOffset: 0, channel: 'sms', body: '{{firstName}}, this is {{agent}}. For a new build in {{area}} the next useful step is a plan + a draw schedule. Want a 15-minute call?' },
      { dayOffset: 4, channel: 'sms', body: 'Allowances vs bids vs estimates change who holds the risk. Reply STOP to opt out.' },
      { dayOffset: 12, channel: 'email', subject: 'New-build path in {{area}}', body: 'Hi {{name}},\n\nIf you are still considering new construction under {{budget}}, keep the land piece separate so you do not pay for a lot twice.\n\n— {{agent}}' },
    ],
  },
  {
    id: 'stale-lead-reengage',
    name: 'Stale lead re-engage',
    description: 'Soft ping for cold or lost contacts',
    triggerStage: 'nurture',
    steps: [
      { dayOffset: 0, channel: 'sms', body: 'Hi {{firstName}} — {{agent}} here. Still looking in {{area}}, or did plans change? Reply STOP to opt out.' },
      { dayOffset: 14, channel: 'email', subject: 'Should I close your file?', body: 'Hi {{name}},\n\nReply KEEP to stay on Eastern Idaho updates. Otherwise I will close the file.\n\n— {{agent}}' },
    ],
  },
];
