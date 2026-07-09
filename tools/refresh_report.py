"""Compare the live data feeds against events.json and report drift.

Run:  python tools/refresh_report.py   (from the site root)

Checks the two machine-readable sources:
  - Visit Patrick County tourism feed (ImGoing)
  - Reynolds Homestead calendar (VT calendar widget)

Reports feed events with no counterpart on the site (NEW) and site
entries sourced from a feed whose dates no longer line up (CHANGED).
Purely read-only: prints a report, changes nothing.
"""
import json
import re
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

NY = ZoneInfo('America/New_York')
ROOT = Path(__file__).resolve().parent.parent

IMGOING = ('https://api.imgoingcalendar.com/api/visitors/PatrickCoVA/events'
           '?page=1&limit=100&category=All&source=google&useFuzzyQuery=true&searchFields=name,address')
REYNOLDS = ('https://pamplinstorage.blob.core.windows.net/calendarwidget-v2/'
            'ec5e9b88-6d92-42e9-b794-0c87cdb5dab8.json')


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'patrickcounty.life refresh'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8-sig'))


def norm(name):
    name = name.lower()
    name = re.sub(r'[^a-z0-9 ]+', ' ', name)
    drop = {'the', 'a', 'an', 'at', 'of', 'and', 'with', 'on', 'in', 'for', 'to'}
    return ' '.join(w for w in name.split() if w not in drop)


# Known feed titles -> site event ids (None = deliberately not listed:
# out-of-county, registered camps, or vendor-booth appearances)
ALIASES = {
    'willis gap open jam': 'willis-gap-open-jam',
    'rotary tap pints teachers': 'rotary-on-tap-2026-07-15',
    'third thursday stagecoach coffee home porch leaner interchangeable o': 'stagecoach-third-thursday-2026-07-16',
    'joint meeting patrick county chamber rotary club stuart connecting communities': 'rural-everywhere-2026-07-27',
    'wills gap golden oldies': 'willis-gap-golden-oldies',
    'patrick county fairgrounds': 'demolition-derby-2026',
    'homestead artisan series indigo shabori': 'indigo-shibori-2026-08-30',
    'indigo shabori homestead artisan series': 'indigo-shibori-2026-08-30',
    'storytime spencer penn centre': None,
    'build bot science camp': None,
    'art camp grace helms': None,
    'art camp reception': None,
    'career trailblazers': None,
    'superhero camp': None,
    'reynolds homestead market': None,
    'heritage sunday tours porch culture pickin porch': 'heritage-sunday-porch-2026-07-19',
    'little historians story activity historic porch': 'little-historians',
    'painting grace homestead artisan series': 'painting-with-grace-2026-07-26',
    'we impact virginia role community succession transition': 'we-impact-virginia-2026-07-08',
}


def to_local_date(ts):
    dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo('UTC'))
    return dt.astimezone(NY).strftime('%Y-%m-%d')


def site_events():
    return json.load(open(ROOT / 'events.json', encoding='utf-8'))['events']


def site_dates(e):
    if 'date' in e:
        return {e['date']}
    r = e.get('recurs', {})
    if 'dates' in r:
        return set(r['dates'])
    return None  # weekly/monthly rules: skip date comparison


def main():
    site = site_events()
    site_by_norm = {}
    for e in site:
        site_by_norm.setdefault(norm(e['title']), []).append(e)
    today = datetime.now(NY).strftime('%Y-%m-%d')

    feeds = []
    try:
        ig = fetch(IMGOING)
        feeds.append(('ImGoing/VisitPatrickCounty', [
            (ev.get('name', '').strip(),
             sorted({to_local_date(t['startTime']) for t in ev.get('eventTimes') or [] if t.get('startTime')}),
             (ev.get('eventLink') or '').strip())
            for ev in ig]))
    except Exception as ex:
        print('!! ImGoing feed failed:', ex)
    try:
        rh = fetch(REYNOLDS)
        feeds.append(('Reynolds Homestead', [
            (ev.get('title', '').strip(), sorted({to_local_date(ev['start'])}) if ev.get('start') else [], '')
            for ev in rh]))
    except Exception as ex:
        print('!! Reynolds feed failed:', ex)

    for src, items in feeds:
        print(f'=== {src} ===')
        for name, dates, link in items:
            future = [d for d in dates if d >= today]
            if not future:
                continue
            n = norm(name)
            if n in ALIASES:
                sid = ALIASES[n]
                if sid is None:
                    continue
                matches = [e for e in site if e['id'] == sid]
            else:
                matches = site_by_norm.get(n)
            if not matches:
                # fuzzy: try containment either way
                matches = [e for k, es in site_by_norm.items() for e in es
                           if norm(name) and (norm(name) in k or k in norm(name))]
            if not matches:
                print(f'  NEW: {name!r} on {", ".join(future[:6])}{" ..." if len(future) > 6 else ""} {link[:60]}')
                continue
            e = matches[0]
            sd = site_dates(e)
            if sd is not None:
                missing = [d for d in future if d not in sd]
                if missing:
                    print(f'  CHANGED: {name!r} feed has dates not on site: {", ".join(missing[:6])} (site id {e["id"]})')
        print()

    print('Done. NEW = consider adding; CHANGED = verify with the organizer.')


if __name__ == '__main__':
    main()
