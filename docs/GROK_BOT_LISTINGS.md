# Grok Bot — use the brokerage listings feed, not Navica login

Grok Bot should **not** sign into Navica / Form Simplicity in a shared Chrome
session for listing research, CMAs, or inventory pulls. Navica allows one
concurrent member session; the bot kick-out is policy, not a bug.

## Source of truth

Public IDX (already licensed and filtered — no BBO / private remarks):

```
GET https://www.archibaldbagley.com/api/listings/live?top=200&fields=full
GET https://www.archibaldbagley.com/api/listings/live?city=Rigby&top=50
GET https://www.archibaldbagley.com/api/listings/live?id=2185506
```

SummitForge `fetchArchibaldNavicaListings()` now calls this endpoint first,
normalizes to `NormalizedListing`, and only falls back to direct `NAVICA_*`
credentials or demo data if the brokerage API is down.

## Bot routing

When the user asks for comps, CMAs, inventory, or “what’s on market”:

1. Call `/api/listings/live` (or SummitForge import `live-navica`).
2. Do **not** open navica.mlspin / Flexmls login.
3. Reserve the human Navica seat + Form Simplicity for contract writing only.
4. If an admin/staff MLS seat is needed for private fields, use a dedicated
   staff login on a separate profile — never the same member ID as the owner.

## Env

```
ARCHIBALD_LISTINGS_URL=https://www.archibaldbagley.com/api/listings/live
```
