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

## Pull & smoke

```bash
cd ~/SummitForge-RE-OS
git pull origin main
npm run dev
```

1. `/portal` — PIN `demo` → Schedule showing  
2. `/crm` — Showing requests + Nurture  
3. `/cma` — Run CMA → Export professional PDF  
4. `/settings/branding` — set company/phone → CMA PDF picks it up  
5. `/alerts` — Re-run Matching → portal  

## Next

- Twilio SMS delivery for nurture steps  
- Navica IDX live credentials  
- Forms Simplicity e-sign  
- Multi-tenant switcher UI polish  
