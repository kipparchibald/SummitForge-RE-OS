# Canonical app moved

**As of 2026-08-04, SummitForge + Archibald-Bagley ship as one product:**

| | |
|--|--|
| **Canonical repo** | https://github.com/kipparchibald/archibald-bagley |
| **Production** | https://archibald-bagley.vercel.app |
| **Product name** | SummitForge |
| **Public brand** | Archibald-Bagley |
| **Navica** | Live `nav91` (SRRMLS) on the canonical deploy |

This `SummitForge-RE-OS` tree remains a **feature donor** (GIS/Mapbox, AI council, Supabase dual-store CRM, Twilio, Stripe white-label). New work should land in **archibald-bagley** unless you are extracting a module to port.

Do **not** put live Navica credentials only on this Next.js project while the public IDX site is on archibald-bagley.
