# Deployment identity (source of truth)

| Layer | Value |
|-------|--------|
| **Vercel team / project** | `voxli` / **`summit-forge-re-os`** |
| **Production URL** | https://summit-forge-re-os-voxli.vercel.app |
| **GitHub repo** | [kipparchibald/SummitForge-RE-OS](https://github.com/kipparchibald/SummitForge-RE-OS) |
| **npm package name** | `summitforge-re-os` |
| **User-facing brand** | **Voxli.dev** (UI title / sidebar / exports) |
| **Local dev** | http://localhost:3000 |
| **Status** | **Production ready** (ops confirmed 2026-07-30) |

## Naming (don’t confuse these)

| Name | What it is |
|------|------------|
| `summit-forge-re-os` | Vercel project slug + historical repo path |
| `summitforge-re-os` | `package.json` name |
| **Voxli.dev** | Product brand users see |
| `summitforge-demo` | Separate **demo** Vercel project (keep `DEMO_MODE=true`) |

## Quick checks (prod)

```bash
# Expect app auth middleware → /login when DEMO is off (not Vercel SSO)
# Open while signed into Vercel if Deployment Protection is on:
open https://summit-forge-re-os-voxli.vercel.app/api/health
```

Healthy production roughly:

- `mode: "production"`
- `supabase.schemaOk: true`
- no demo banner in the UI after login

## Related docs

- Full feature deploy history: root `README.md`
- Navica live feed: `docs/NAVICA-GO-LIVE.md`
- Sprint board: `docs/SPRINT_PRODUCTION.md`
