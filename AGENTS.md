# AGENTS.md — SummitForge RE OS

This is the SummitForge real estate operating system.

**Separate product:** IdeaSpeak is a voice-to-app builder in `/Users/kipp/ideaspeak-app`. Do not merge IdeaSpeak builder UI, Sandpack, or voice-refiner product code into this repo. Do not track IdeaSpeak status here.

## Scope
- Land deals, development analysis, plats, monitoring
- AI assistants (valuation, marketing, council, transaction, leads)
- Import/MLS, analytics, client portal, white-label branding

## For any AI working here
- Stay in this repo and domain only.
- Prefer production Next.js patterns already in `app/` and `lib/`.
- Keep env secrets out of the client; use server routes for AI keys.
- Do not pull IdeaSpeak builder features “because they’re cool” — different product.
