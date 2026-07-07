# PatrickCounty.life

A community event calendar for Patrick County, Virginia. Pure static site — no database, no framework, no monthly software bill. Events live in one JSON file; hosting is free.

## Files

| File | What it is |
|---|---|
| `index.html` | The calendar (list + month views, search, category filters) |
| `events.json` | **All event data lives here** — edit this to update the site |
| `app.js` / `styles.css` | Calendar logic and styling |
| `advertise.html` | Sponsorship sales page (edit the pricing tiers to taste) |
| `admin.html` | Private helper: fill a form, copy the JSON, paste into `events.json` |

## ⚠️ Before launch

The seeded events are **samples with guessed dates**. Real Patrick County events were used as inspiration (Ag Fair, farmers market, Kibler Valley, etc.), but every date, time, and detail must be verified with the organizers before the site goes public.

Also swap `mail@brycesimmons.com` for a domain address (e.g. `events@patrickcounty.life`) once you set up email forwarding — it appears in `index.html` and `advertise.html`.

## Adding / editing events

1. Open `admin.html` in a browser (double-click it — works offline).
2. Fill in the form, click **Copy to clipboard**.
3. Paste into the `events` array in `events.json` (add a comma after the previous event).
4. Save. If hosted on Cloudflare Pages via GitHub, commit + push and it's live in ~30 seconds.

Weekly repeating events (farmers market, etc.) use the `recurs` field — check "Repeats weekly" in the helper. Past events are hidden automatically; you never need to delete anything.

## Going live (free hosting)

**Recommended: Cloudflare Pages** (free tier is more than enough, and Cloudflare can also manage the domain's DNS):

1. Put this folder in a GitHub repo (`git init`, push).
2. In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**, pick the repo. No build command; output directory = `/`.
3. **Custom domains** → add `patrickcounty.life`. Cloudflare walks you through pointing the domain's nameservers or DNS records at it. HTTPS is automatic.

Alternative: Netlify drag-and-drop (no GitHub needed — drag this folder onto app.netlify.com), then add the custom domain the same way.

## Making money

Realistic expectations for a rural county site: traffic will likely be hundreds to a few thousand visits/month at first. That's worth almost nothing to Google AdSense (~$2–10 per thousand pageviews → maybe $5–30/month) but it is worth real money to **local businesses**, because the audience is exactly their customers.

**Plan A — direct local sponsorships (do this first):**
- `advertise.html` is your sales page: $25 / $50 / $100 per month tiers (edit freely).
- Five local sponsors at $50/month = $250/month — that covers hosting (free), the domain (~$30/yr), and pays you for your time.
- Best first prospects: restaurants, orchards/wineries, insurance & realty offices, banks, the funeral home, anyone who already buys ads in the local paper. The Rotary/Chamber network is the natural channel.
- To place a sponsor: replace an `.ad-slot` placeholder in `index.html` with their logo + link.

**Plan B — Google AdSense (add later, once traffic is steady):**
1. Apply at adsense.google.com with the live site (they reject empty/new sites — wait until you have real content and some traffic).
2. When approved, paste your ad-unit code where the `.ad-slot` placeholders are, and create an `ads.txt` file in this folder with the line AdSense gives you.
3. Keep at least one direct-sponsor slot — local ads will out-earn AdSense here.

**Traffic drivers (this is what makes the ad money possible):**
- A Facebook page that posts "This weekend in Patrick County" every Thursday, linking to the site. Facebook is where this audience already is.
- The SEO groundwork is already in the site (meta tags + schema.org Event markup), so Google can show the events for searches like "things to do in Patrick County".
- Submit the site to the Chamber of Commerce, the Enterprise, and visitor-center links pages.

## Keeping it fresh (the real work)

A stale calendar kills the site. A sustainable routine:
- **30 minutes weekly**: sweep the county's Facebook pages/groups, Chamber newsletter, Reynolds Homestead calendar, Fairy Stone park programs, school athletics, church signs. Add what you find via `admin.html`.
- The **Submit an Event** links email you event details in a ready-to-paste format — free listings mean organizers do some of the work for you.
- Later upgrades if it takes off: a real submission form (Tally.so free tier → email), a weekly email newsletter (Buttondown), or automated scraping of organizer Facebook pages.
