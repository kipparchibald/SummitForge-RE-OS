# Summit Forge — Moxi / Compass polish status

Updated: 2026-07-27

## Shipped on `main`

| Feature | Status | Where |
|---------|--------|-------|
| Client portal match feed | ✅ | `/portal` PIN `demo` |
| Schedule showing | ✅ | Portal → CRM ShowingInbox |
| Alert rematch → portal push | ✅ | `/alerts` Re-run Matching |
| CMA Export professional PDF | ✅ | `/cma` after Run CMA |
| White-label on CMA PDF | ✅ | Settings branding → export |
| Nurture sequences + CRM panel | ✅ | `/crm` |
| Showing request inbox | ✅ | `/crm` sidebar |
| GIS → CMA handoff | ✅ | `/monitoring` → CMA |
| Jefferson owner-of-record (TLS) | ✅ | `/api/gis/parcel` → assessor |
| Offer win-probability engine | ✅ | `/offer` |
| Realtime + toasts + health strip | ✅ | layout / dashboard |
| Expanded smoke (151 checks) | ✅ | `npm run test:smoke` |

## Pull & smoke

```bash
cd ~/SummitForge-RE-OS
git pull origin main
npm install
npm run dev
# full live suite:
SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke
npm run typecheck
```

1. `/portal` — PIN `demo` → Schedule showing  
2. `/crm` — Showing requests + Nurture  
3. `/cma` — Run CMA → Export professional PDF  
4. `/settings/branding` — set company/phone → CMA PDF picks it up  
5. `/alerts` — Re-run Matching → portal  
6. `/monitoring` — click parcel → **Owner of record** from Jefferson assessor  
7. `/offer` — score a list/offer price  

## Verified 2026-07-27

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `SMOKE_BASE_URL=… npm run test:smoke` | **151 passed, 0 failed** |
| GIS point Rigby | Owner `HOME INSURANCE CLAIM` + situs |
| GIS PIN RP04N34E360000 | Owner `STATE OF IDAHO` + legal acres 560 |
| Health / pages / land-scan / plat / analyze | 200 |

## Next

- Twilio SMS delivery for nurture steps  
- Navica IDX live credentials  
- Forms Simplicity e-sign  
- Multi-tenant switcher UI polish  
- Jefferson portal: full LE intermediate chain (upstream cert)
