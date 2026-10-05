# Lost Children Charity Platform (CharityBusiness)

<p align="center"><img src="docs/system-overview.svg" alt="System overview of the Lost Children Charity Platform. Today any HTTP client calls the API over HTTP with JSON; POST bodies are Zod-checked and no route checks auth. A planned Android app (Gradle config, no Kotlin; Retrofit planned) and a planned web dashboard (Tailwind config, no pages) are drawn dashed. Inside web/, a Next.js 14 App Router app, three API routes: /api/locations (GET list with an optional ?overdue filter, POST create), /api/locations/:id/mark-changed (POST, resets the timer) and /api/routes/optimize (POST, visit order plus totals). All three call LocationController (list, create, reset timer), which derives status through utils.ts (fresh under 7 days) and reaches PostgreSQL through Prisma Client; a reset is an update plus an insert in one $transaction. The optimize route also calls getLocationById per id, then optimizeRoute(origin, addresses) in utils.ts, which asks the Google Maps Directions API for a round trip with optimize:true and gets back waypoint_order and legs. In PostgreSQL, locations and box_changes are the live tables and lastBoxChange is the timer; routes, route_stops and users are modeled but never written." width="100%"></p>

A platform for keeping charity **candy donation boxes** stocked: every location is a **timer**. The core stores one timestamp per location — `lastBoxChange` — and everything the platform reports (**elapsed days**, **fresh/overdue status**, "3 days ago") is *derived* from it on every read, never stored. A worker's one-tap **"Mark as Changed"** resets the timer and appends an immutable `BoxChange` history row in a single transaction; a **route optimizer** hands Google Maps Directions the locations the caller picks (meant to be the overdue ones) and gets back the best visiting order with total miles and minutes.

The interesting part isn't the endpoints — it's the honest shape of the repo: of the four components laid out (`android/`, `backend/`, `web/`, `docs/`), **exactly one is implemented**. The entire working platform is **983 lines of TypeScript** in `web/`: a headless **Next.js 14 App Router** API with three endpoints, a controller, a **Prisma/PostgreSQL** schema, and **Zod** validation on every POST body. The Android client is Gradle build config and a manifest with no Kotlin behind it, `backend/` is five empty directories, and the web UI is a ring of empty folders around a working API — empty folders that git never tracked, so neither `backend/` nor those UI folders appear in a clone of the repository. This README documents what's real, what's scaffold, and where the sharp edges are.

---

## Table of Contents

1. [How the Timer Loop Works](#how-the-timer-loop-works)
2. [Repository Map](#repository-map)
3. [The Data Model](#the-data-model)
4. [The API Surface](#the-api-surface)
5. [Route Optimization](#route-optimization)
6. [The Planned Clients](#the-planned-clients)
7. [Build & Run](#build--run)
8. [Known Limitations & Sharp Edges](#known-limitations--sharp-edges)
9. [Provenance](#provenance)

---

## How the Timer Loop Works

<p align="center"><img src="docs/timer-loop.svg" alt="Flowchart of the timer loop. Left column: a charity worker (any HTTP client today, no auth check; the planned Android app has no Kotlin yet) calls GET /api/locations?overdue=true. getOverdueLocations fetches every active row with its newest BoxChange, runs calculateElapsedDays on each and keeps the overdue ones, returning JSON { success, data, count } in which overdue rows read 1 week ago or N days ago (N at least 14). The worker picks location ids, overdue or not, and calls POST /api/routes/optimize with currentLocation, at least one id and an optional returnToStart; getLocationById re-derives each one, and optimizeRoute asks the Google Maps Directions API with optimize:true waypoints and destination equal to origin, so the route is always a round trip. The result is the visit order, total miles and minutes including the return leg, and a Current Location → A → B summary. After restocking, the worker sends one POST per location visited to /api/locations/:id/mark-changed (optional changedBy, notes and boxCount; an empty body is a 500), whose prisma.$transaction sets lastBoxChange and updatedAt to now and appends one box_changes row, both or neither; the response re-derives 0, fresh, Today without storing them, and the next visit cycle begins. Right panel: POST /api/locations sets lastBoxChange to now and writes no BoxChange row; lastBoxChange is the only stored timer and there is no status column. days = floor((now − lastBoxChange) / 86,400,000 ms), fresh below 7 and overdue from 7. A day ruler shows Today, 1 day ago, N days ago for days 2–6, 1 week ago for 7–13 and N days ago from 14; Mark as Changed puts any day back to day 0, and status flips on the next read with no cron job and no write. WARNING_THRESHOLD 14 is never read, so warning is unreachable." width="100%"></p>

Nothing ever writes a status to the database. The `locations` row keeps one timestamp; freshness, elapsed days, and the human-readable "1 week ago" are recomputed by [utils.ts](web/src/lib/utils.ts) on every read, so a location silently drifts from `fresh` to `overdue` at the 7-day mark with no cron job, no background worker, and nothing to get out of sync.

## Repository Map

```text
CharityBusiness-main/
├── README.md                     # you are here
├── SYSTEM-DESIGN.md              # the architecture-level view
├── FILELIST.txt                  # local only, not in git — 27,780-line recursive listing (incl. .git internals)
├── docs/
│   ├── SECURITY.md               # key-handling policy (Google Maps, Stripe, keystores) —
│   │                             #   written for a bigger platform than was built (no Stripe anywhere)
│   ├── system-overview.svg       # system overview diagram at the top of this README
│   ├── timer-loop.svg            # the timer loop diagram (How the Timer Loop Works)
│   ├── system-design-flowchart.svg   # SYSTEM-DESIGN.md end-to-end flowchart
│   ├── optimize-call.svg         # SYSTEM-DESIGN.md deep dive 1 — one optimize call
│   └── timer-and-reset.svg       # SYSTEM-DESIGN.md deep dive 2 — the timer and its reset
├── backend/                      # ⚠ five EMPTY directories: config/ controllers/ middleware/ models/ routes/
│                                 #   from the first "shared backend (if separate)" plan; the real backend lives in web/src/app/api
│                                 #   local only: git does not track empty dirs, so a clone has no backend/
├── android/                      # ⚠ Gradle config + manifest only — zero Kotlin source files
│   ├── build.gradle              # AGP 8.1.2, Kotlin 1.9.10, Compose 1.5.4, secrets-gradle-plugin
│   ├── app/build.gradle          # com.charity.lostchildren — SDK 24→34, Compose, Room, Retrofit, Maps
│   ├── app/src/main/AndroidManifest.xml   # permissions + .MainActivity (which doesn't exist)
│   ├── local.properties.example  # SDK path / Maps key / API base-URL template
│   └── {app/…}                   # ⚠ local-only empty dirs from a mkdir -p whose outer brace never expanded — see sharp edges
└── web/                          # ✅ the implemented component: a headless Next.js 14 App Router API
    ├── package.json              # next / prisma / zod / @googlemaps — plus next-auth & zustand,
    │                             #   installed but never imported
    ├── prisma/schema.prisma      # 5 models: Location, BoxChange, Route, RouteStop, User (+ UserRole)
    ├── src/
    │   ├── app/api/
    │   │   ├── locations/route.ts                    # GET list (+ ?overdue=true) / POST create
    │   │   ├── locations/[id]/mark-changed/route.ts  # POST — the timer reset ("THE CORE FEATURE!")
    │   │   └── routes/optimize/route.ts              # POST — Google-optimized visiting order
    │   ├── lib/
    │   │   ├── controllers/locationController.ts     # location CRUD, timer reset, analytics (4 of 9 methods unwired)
    │   │   ├── db.ts                                 # PrismaClient singleton, dev-global cached
    │   │   └── utils.ts                              # elapsed-day math, Google Maps calls, error model
    │   ├── types/index.ts        # domain + API types, TIME_THRESHOLDS (7 / 14 days)
    │   └── app/analytics|auth|locations|routes, components/, hooks/, styles/   # ⚠ all empty, local only (not in git) — no UI
    ├── .env                      # local only, gitignored, never committed — see sharp edges
    ├── env.example / env.example.template   # two generations of env templates
    ├── next.config.js            # still carries Next 13's experimental.appDir flag
    ├── tailwind.config.js        # charity color palette — no page or stylesheet uses it yet
    ├── tsconfig.json             # local only, not in git — strict: false, "@/*" → src/* (the alias every internal import relies on)
    └── .next/                    # local only, gitignored — dev-server output
```

## The Data Model

[schema.prisma](web/prisma/schema.prisma) defines five models, of which the first two do all the work:

- **`Location`** — name, address, `latitude`/`longitude` floats, optional contact person/phone/description/notes, `isActive` for soft deletes, and the load-bearing field: `lastBoxChange DateTime @default(now())`. Every status the platform reports is arithmetic on this one column.
- **`BoxChange`** — the append-only audit trail: `locationId`, `changedAt`, optional `changedBy`, `notes`, `boxCount`. Cascade-deletes with its location. A location's history is never edited, only appended.
- **`Route` / `RouteStop`** — a persisted-routes design (stop order, completion tracking, `@@unique([routeId, stopOrder])`) that **nothing ever writes**. The optimizer returns its result and forgets it.
- **`User` + `UserRole`** (`ADMIN`/`MANAGER`/`WORKER`) — an auth model with no auth system attached (see [sharp edges](#known-limitations--sharp-edges)).

[types/index.ts](web/src/types/index.ts) layers the derived vocabulary on top: `LocationResponse` adds `elapsedDays`, `status`, and `lastChangeFormatted` to the raw row, and `TIME_THRESHOLDS` pins the constants — `FRESH_THRESHOLD: 7`, `WARNING_THRESHOLD: 14`. Only the first is ever read: the code collapsed the planned three-state `fresh`/`warning`/`overdue` into two states, and `'warning'` survives only in the type unions.

## The API Surface

Three endpoints; the three POST handlers follow the same shape: a **Zod schema** at the top of the route file, `schema.parse(body)`, a call into [`LocationController`](web/src/lib/controllers/locationController.ts), and a `{ success, data, message }` JSON envelope, while `GET /api/locations` only checks `?overdue=true` and returns `{ success, data, count }`. Zod failures return 400 with the issue list; everything else flows through `handleApiError`, which sniffs Prisma error messages into 409 (`Unique constraint`) and 404 (`Record to update not found`). The optimize route also answers 400 `NO_VALID_LOCATIONS` when no id matches a row, and 503 `ROUTE_OPTIMIZATION_FAILED` when the Google Maps step throws.

| Endpoint | What it does |
|---|---|
| `GET /api/locations` (+ `?overdue=true`) | All active locations with `elapsedDays`, `status`, `lastChangeFormatted`, and the most recent `BoxChange`; the flag filters to overdue only |
| `POST /api/locations` | Create a location — name, address, lat (±90) / lng (±180), optional contact fields; timer starts fresh at creation |
| `POST /api/locations/:id/mark-changed` | The core feature: one `prisma.$transaction` resets `lastBoxChange` to now **and** appends a `BoxChange` row — both or neither |
| `POST /api/routes/optimize` | `{ currentLocation, locationIds[], returnToStart? }` → optimized visiting order, total miles/minutes, and a `"Current Location → A → B → …"` summary |

The controller holds more surface than the API exposes: `updateLocation`, `deleteLocation` (soft), `batchMarkBoxesChanged`, and `getLocationAnalytics` are fully implemented but **no route calls them** — location editing, deletion, and the analytics dashboard were built to the controller layer and stopped there.

## Route Optimization

[utils.ts](web/src/lib/utils.ts) wraps `@googlemaps/google-maps-services-js`. The optimize endpoint loads each requested location from the database and hands `optimizeRoute` the *addresses* (not the coordinates); it asks Google for `directions` with `optimize: true` — which the client library serializes as the `waypoints=optimize:true|…` parameter, making Google solve the traveling-salesman ordering. The response's `waypoint_order` is mapped back to locations **by exact address string equality**, and total distance/duration are summed from each leg's *display text* (`"3.2 mi"`, `"8 mins"`) rather than the numeric meter/second values — a choice with teeth, see [sharp edges](#known-limitations--sharp-edges).

Also in the toolbox but never called from any route: a Distance Matrix wrapper (`calculateDrivingDistances`), a geocoder (`addressToCoordinates`), and a haversine fallback (`calculateStraightLineDistance`, Earth radius 3,959 mi).

## The Planned Clients

- **Android** ([android/](android/)) — a complete *build configuration* for `com.charity.lostchildren`: Kotlin 1.9.10, Jetpack Compose 1.5.4, Navigation, ViewModel, **Room** 2.6.1 for offline caching, **Retrofit** 2.9.0 for the REST calls, Maps Compose 2.15.0, and the secrets-gradle-plugin injecting `GOOGLE_MAPS_API_KEY` from `local.properties` into the manifest. What's missing is the app: there are **no Kotlin files, no `res/` directory, no `settings.gradle`, no Gradle wrapper**, and the manifest's `.MainActivity`, theme, icons, and backup-rules XMLs don't exist. The intended architecture is still legible in the accidental `{app/…}` directories of the local working copy (empty, so never tracked by git): `ui/auth`, `ui/tracking`, `ui/distribution`, `ui/maps`, `data`, `domain`, `network`, `utils`.
- **Web UI** — `src/app/analytics`, `auth`, `locations`, `routes`, plus `components/`, `hooks/`, and `styles/` are all empty local folders that git never tracked; there is **no `page.tsx` or `layout.tsx` anywhere**. Tailwind is configured with a `charity` palette that nothing renders. The Next.js app is an API server wearing a full-stack framework.
- **`backend/`** — `config/`, `controllers/`, `middleware/`, `models/`, `routes/`: five empty directories from the initial layout's "shared backend (if separate)" plan, superseded by the App Router API in `web/`; being empty, they were never tracked by git and are absent from a clone.

## Build & Run

What you actually need: **Node.js 18.17+**, a **PostgreSQL** database, and a **Google Maps API key** with the Directions API enabled. There is nothing to build in `android/` or `backend/`. A fresh clone also needs a `web/tsconfig.json`: that file is not in git, yet every internal import goes through its `"@/*"` path alias, so add one with `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }` before `npm run dev`.

```bash
cd web
npm install

# configure — copy the template, fill in your own values
cp env.example .env          # DATABASE_URL, GOOGLE_MAPS_API_KEY, NEXTAUTH_SECRET

npm run db:generate          # prisma generate
npm run db:push              # push schema to the database (or db:migrate for migrations)
npm run dev                  # API at http://localhost:3000
```

Smoke-test it with any HTTP client — there is no UI and no seed data (`npm run db:seed` points at a `prisma/seed.ts` that doesn't exist), so the first location comes in by hand:

```bash
curl -X POST localhost:3000/api/locations -H 'Content-Type: application/json' \
  -d '{"name":"Downtown Food Bank","address":"123 Main St, Detroit, MI","latitude":42.3314,"longitude":-83.0458}'
curl localhost:3000/api/locations
curl -X POST localhost:3000/api/locations/<id>/mark-changed -H 'Content-Type: application/json' -d '{}'
```

`prisma studio` (`npm run db:studio`) is the closest thing to an admin UI. Deployment notes in the original docs assume Vercel + managed Postgres, with secrets set in the dashboard.

## Known Limitations & Sharp Edges

Honest notes — some are scope cuts, several are latent bugs, one is a security incident in waiting:

- **A local `web/.env` holds real-looking credentials** — a Google Maps API key, a 64-hex `NEXTAUTH_SECRET`, and a Postgres password. `.gitignore` (`**/.env`) has kept it out of every commit, as [SECURITY.md](docs/SECURITY.md) intends, so the repository does not ship it; if that working folder was ever shared, rotate the Maps key and use your own database credentials.
- **Anyone can do anything.** `next-auth` is installed, `NEXTAUTH_SECRET` is configured, and the `User`/`UserRole` model exists — but there is no NextAuth route, no session check, no middleware. All endpoints are unauthenticated, including every write.
- **`returnToStart` is cosmetic.** The Google request always sets `destination: origin`, so the route *always* returns to start and the totals always include the return leg; the flag only decides whether the summary string ends with "Current Location".
- **Distances are parsed from display text.** `parseFloat("3.2 mi")` works — but with imperial units Google reports short legs in feet, so `"528 ft"` parses as **528 miles**; and `parseInt` on `"1 hour 12 mins"` yields **1 minute**. Any trip with an hour-plus leg or a sub-0.1-mile hop reports garbage totals.
- **Address-equality mapping.** The optimized order is matched back to locations by `loc.address === address`; two locations sharing an address will both map to the first one.
- **`'warning'` is unreachable.** The three-state status type and the `WARNING_THRESHOLD: 14` constant survive in [types/index.ts](web/src/types/index.ts), but the logic is binary (`< 7` fresh, else overdue) and analytics hardcodes `warningCount: 0`. Comments claiming overdue means "> 14 days" are stale — it's ≥ 7.
- **An empty POST body 500s.** `mark-changed`'s fields are all optional, but `request.json()` throws on an empty body before Zod ever runs — send `{}` at minimum.
- **Half the controller is unwired.** `updateLocation`, `deleteLocation`, `batchMarkBoxesChanged`, `getLocationAnalytics` have no routes; `calculateDrivingDistances` is imported by the optimize route and never called. There is no way to edit or delete a location over HTTP.
- **`Route`/`RouteStop` are schema-only.** Optimized routes are never persisted; `getOverdueLocations` fetches *all* locations and filters in JS; `activeLocations` always equals `totalLocations` (the query already filters `isActive`).
- **The `android/{app` directories** are a shell accident: an `mkdir -p android/{app/src/main/java/com/charity/{…}} android/{app/src/main/res}` whose outer braces held no comma and so never expanded, leaving a literal `{app` directory and a stray `}` on every leaf (`ui/auth}`, `utils}`, `res}`). Harmless, empty, local-only (git does not track empty directories, so none of them is in the repository), and — together with the real empty package dirs `ui/locations` and `ui/toggle` under `android/app/src/main/java/com/charity/` — the fullest record of the intended package layout.
- **Config drift** — `next.config.js` still sets Next 13's `experimental.appDir` (Next 14 warns about it) and plumbs a `CUSTOM_KEY` env var that is never defined; `tsconfig.json` (local only, not in git) has `strict: false`; the two env templates disagree on variable names (`GOOGLE_MAPS_API_KEY` vs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`); `FILELIST.txt` and `web/.next/` are local build debris that git does not track.
- **No tests.** Not one — see the [verification section of SYSTEM-DESIGN.md](SYSTEM-DESIGN.md#verification--testing-status).

## Provenance

A solo project — no teammates, course, or organization is credited anywhere in the repository, and the original README credits only its solo author, pitching the planned platform (vision, market potential, copyright) around the same stack. Judged by content, all TypeScript in [web/src/](web/src) is project-authored (the only generated file is `next-env.d.ts`); the Android Gradle files and manifest are standard Android Studio-shaped configuration authored for a client that was never started; [docs/SECURITY.md](docs/SECURITY.md) is project-authored policy. Third-party foundations: **Next.js 14**, **Prisma 5**, **Zod**, **@googlemaps/google-maps-services-js**, **date-fns**, and **Tailwind** (config only). GitHub: [KuyaBasti/CharityBusiness](https://github.com/KuyaBasti/CharityBusiness).

See [SYSTEM-DESIGN.md](SYSTEM-DESIGN.md) for the architecture-level view: the full data-flow diagram, the ideas behind the design, and the numbers that matter.
