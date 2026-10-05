# Lost Children Charity Platform — system design

> Every location is a clock that only moves forward.
>
> The database stores a single fact per candy box location — when it was last
> restocked — and the platform's entire vocabulary (**elapsed days**, **fresh**,
> **overdue**, *"3 days ago"*) is recomputed from that one timestamp on every
> read. Nothing stores a status, so nothing can get out of sync. A worker's tap
> resets the clock and appends one immutable history row in a single
> transaction; the traveling-salesman problem of visiting the boxes a worker
> picks (meant to be the overdue ones) is handed, whole, to **Google's Directions
> API**. Around this working core stand
> the outlines of the platform it was meant to become — an Android client, a
> web dashboard, an auth layer — present as build config, dependencies, and
> schema, but not yet as code.

This document is the developer-facing map of the whole system — every component
and how data moves between them. The companion [README](README.md) covers the
per-layer detail, building, and running.

---

## End-to-end flowchart

<p align="center"><img src="docs/system-design-flowchart.svg" alt="End-to-end flowchart of the Lost Children Charity Platform. Clients: any HTTP client drives the API today; a planned Android app (Kotlin, Compose, Retrofit, Room and Maps declared in Gradle, zero Kotlin files, API_BASE_URL pointing at localhost:3000/api) and a planned web dashboard (Tailwind config, no page.tsx or layout.tsx) are dashed. API layer: four Next.js 14 route handlers in web/src/app/api, GET /api/locations (?overdue=true for overdue only, no body and no Zod schema), POST /api/locations, POST /api/locations/:id/mark-changed and POST /api/routes/optimize. Each POST body goes through its Zod schema, and a failed parse returns 400: createLocationSchema (name, address, lat ±90 and lng ±180 required), markBoxChangeSchema (every field optional, boxCount a positive integer) and optimizeRouteSchema (currentLocation plus at least one location id, returnToStart defaults to true). The handlers call LocationController: getAllLocations or getOverdueLocations, createLocation, markBoxesChanged, and getLocationById once per id in parallel; 5 of its 9 methods are reached by a route, while updateLocation, deleteLocation, batchMarkBoxesChanged and getLocationAnalytics are not. The controller uses utils.ts (calculateElapsedDays per row, under 7 days fresh, else overdue; isValidCoordinates on create) and the PrismaClient singleton from db.ts, which runs findMany, findUnique, create and update on locations (the lastBoxChange timer and the isActive soft-delete flag) and creates box_changes rows in the same $transaction as the timer reset; the routes, route_stops and users tables are never queried. Each route handler maps any other error through handleApiError in utils.ts to 409, 404 or 500. The optimize route also calls optimizeRoute in utils.ts, which sends the Google Maps Directions API a directions request with origin and destination both set to currentLocation, the addresses as waypoints, optimize true, driving and imperial units, and gets back routes[0] with waypoint_order and legs." width="100%"></p>

---

## How to read it: the three ideas that matter

1. **Status is derived, never stored.** The only state the timer loop
   mutates is `locations.lastBoxChange` (plus `updatedAt` and the rows that
   history appends); apart from creating locations, no route writes anything
   else.
   `elapsedDays`, the `fresh`/`overdue` status, and the human string
   *"1 week ago"* are computed by `calculateElapsedDays` on every read —
   `floor((now − lastBoxChange) / 86,400,000 ms)`, compared against a 7-day
   threshold. That means a box drifts into `overdue` with no cron job, no
   background worker, and no denormalized column to forget to update; the
   read path *is* the state machine. The price is that every consumer gets
   status only by asking, and "overdue" queries aren't pushed into SQL —
   `getOverdueLocations` fetches everything and filters in JS.

2. **One Next.js app is the whole backend — and the routes are the real
   bottleneck of what exists.** Each POST handler follows the same discipline:
   a Zod schema at the top, `schema.parse(body)`, a call into
   `LocationController`, a `{ success, data, message }` envelope, and an
   error path of Zod issues → 400 and everything else → `handleApiError`,
   which pattern-matches Prisma's message strings into 409/404/500. The
   optimize route adds two outcomes of its own: 400 `NO_VALID_LOCATIONS` when
   none of the ids match a row, and 503 `ROUTE_OPTIMIZATION_FAILED` when the
   Google step throws. `GET /api/locations` has no schema and returns `{ success, data, count }`. The
   controller beneath is *wider* than the API above it — update, soft-delete,
   batch mark-changed, and analytics are fully implemented and unreachable —
   so the honest system boundary is the three route files, not the
   controller's method list. The `backend/` directory tree (the first
   README's "shared backend (if separate)") lost to this design and was left
   as five empty folders, which git never tracked, so the repository has no
   `backend/` at all.

3. **The hard problems are outsourced or postponed.** Route ordering goes to
   Google — the client library turns `optimize: true` into the
   `waypoints=optimize:true|…` parameter and Google returns `waypoint_order`;
   the project's own contribution is the id → address → Google → address → id
   round-trip and the summary arithmetic. Authentication is postponed:
   `next-auth` is installed, its secret is configured, `User`/`UserRole` are
   modeled, and no request is ever checked. Route persistence is postponed:
   `Route`/`RouteStop` tables exist and nothing writes them. The system that
   runs is exactly the timer loop — list, optimize, visit, reset.

---

## Deep dive 1 — one optimize call, end to end

`POST /api/routes/optimize` is the most involved flow in the system: the only
endpoint that touches the database *and* the outside world.

<p align="center"><img src="docs/optimize-call.svg" alt="Sequence diagram of one POST /api/routes/optimize call across the client, optimize/route.ts, LocationController, PostgreSQL via Prisma 5, optimizeRoute() in lib/utils.ts and the Google Maps Directions API. The client posts currentLocation, locationIds and an optional returnToStart. The route validates the body with zod (400 VALIDATION_ERROR on failure), then loads every id at once with Promise.all through getLocationById, a Prisma findUnique with the last 10 box_changes that returns the row plus elapsedDays and status, or null. It drops ids with no row (400 NO_VALID_LOCATIONS if none match) and calls optimizeRoute(currentLocation, addresses); lat and lng are not sent. optimizeRoute calls directions() with origin and destination both set to currentLocation (returnToStart is ignored) and waypoints=optimize:true, driving, imperial; it gets routes[0] with waypoint_order and legs, reorders the addresses and sums every leg from its display text, so 528 ft counts as 528 mi and 1 hour 12 mins as 1 min. If that step throws, the route answers 503 ROUTE_OPTIMIZATION_FAILED. The route maps addresses back to locations by exact string equality, first match wins, builds the Current Location → A → B summary (ending in Current Location only if returnToStart) and returns 200 with success, a message and data: optimizedOrder, totalDistance in miles, totalDuration in minutes, routeSummary, estimatedTime and a fixed savings text. Any other error, such as an invalid JSON body or a database failure, becomes 500 INTERNAL_ERROR via handleApiError." width="100%"></p>

Things worth noticing:

- **Google always routes a loop.** `destination` is hardcoded to the origin,
  so with N waypoints the response has N+1 legs and the totals always include
  the drive home. The validated `returnToStart` flag only decides whether the
  summary string gets a trailing "Current Location" — it never reaches the
  Google request.
- **The totals are parsed from display text.** `"3.2 mi"` → 3.2 works;
  `"528 ft"` (imperial short legs) → 528 *miles*, and `"1 hour 12 mins"` →
  `parseInt("1 hour 12")` → **1 minute**. The API response carries numeric
  meter/second values that would make this exact; the code reads the strings.
- **Addresses are the join key.** Locations go to Google as address strings
  and come back matched by `loc.address === address` — two stops sharing an
  address collapse onto the first.

## Deep dive 2 — the timer, and the transaction that resets it

<p align="center"><img src="docs/timer-and-reset.svg" alt="The timer and its reset, in three panels. Stored in PostgreSQL (web/prisma/schema.prisma): the locations table holds lastBoxChange, a DateTime defaulting to now() that is the timer, beside createdAt, updatedAt, an isActive soft-delete flag (the GET list returns active rows only) and plain columns; it has no status or elapsedDays column, and boxChanges is a relation, not a column. box_changes (id, changedAt, locationId referencing locations.id with onDelete Cascade, optional changedBy, notes and boxCount) is append-only. Derived, never stored (web/src/lib/utils.ts): calculateElapsedDays runs for every row a route returns and gives elapsedDays = floor(Δms / 86,400,000), status fresh below FRESH_THRESHOLD 7 and overdue otherwise, and lastChangeFormatted: Today at 0, 1 day ago at 1, N days ago for 2–6, 1 week ago for 7–13 and N days ago from 14; the N weeks ago branch never runs. GET /api/locations returns all three fields for active rows, POST /api/locations returns 0, fresh, Today, and POST /api/routes/optimize gets only elapsedDays and status from getLocationById, which has no isActive filter. The reset, one request to POST /api/locations/:id/mark-changed: request.json() (an empty body throws, 500), the Zod markBoxChangeSchema with all three fields optional (400), then one prisma.$transaction in markBoxesChanged with a single now, where location.update sets lastBoxChange and updatedAt and boxChange.create appends a row with locationId, changedAt and the optional fields. Both commit or both roll back, and an unknown id gives 404. The 200 response re-derives 0, fresh, Today. batchMarkBoxesChanged repeats the pair with updateMany and createMany, but no route calls it. Notes: a new location starts with no box_changes row; the timer never reads box_changes; the reset response does not return the new history row; only the unrouted deleteLocation sets isActive to false, and mark-changed resets a row whether it is active or not; warning and WARNING_THRESHOLD = 14 are declared in types/index.ts but no code path produces warning." width="100%"></p>

- **The transaction is the contract.** The timer column and the audit trail
  are updated atomically, so `lastBoxChange` always has a matching
  `box_changes` row (creation is the one exception: a new location starts
  fresh with no history). `batchMarkBoxesChanged` extends the same shape with
  `updateMany` + `createMany` — implemented, tested by no one, exposed
  nowhere.
- **Listing is history-light, detail is history-deep.** `getAllLocations`
  includes only the single most recent `BoxChange` per location
  (`take: 1`, newest first); `getLocationById` — used by the optimizer —
  pulls the last 10.
- **The formatted string has a gap.** Days 7–13 render as weeks
  ("1 week ago") and everything from 14 up falls back to raw
  "`N` days ago" — the week formatting only ever produces "1 week ago"
  because `weeks = floor(days/7)` is computed under a `days < 14` guard.

---

## Component inventory

| Component | Layer | Provenance | Where |
|---|---|---|---|
| Prisma schema — 5 models + `UserRole` | Data | ✅ implemented here | [schema.prisma](web/prisma/schema.prisma) |
| Prisma client singleton | Data | ✅ implemented here (standard pattern) | [db.ts](web/src/lib/db.ts) |
| Domain + API types, `TIME_THRESHOLDS` | Types | ✅ implemented here | [types/index.ts](web/src/types/index.ts) |
| `LocationController` — location CRUD, timer reset, analytics | Logic | ✅ implemented (4 of 9 methods unwired) | [locationController.ts](web/src/lib/controllers/locationController.ts) |
| Elapsed-time math, Maps wrappers, error model | Logic | ✅ implemented (5 helpers never called) | [utils.ts](web/src/lib/utils.ts) |
| Locations list/create route | API | ✅ implemented here | [locations/route.ts](web/src/app/api/locations/route.ts) |
| Mark-changed route | API | ✅ implemented here | [mark-changed/route.ts](web/src/app/api/locations/%5Bid%5D/mark-changed/route.ts) |
| Route-optimize route | API | ✅ implemented here | [optimize/route.ts](web/src/app/api/routes/optimize/route.ts) |
| Next/Tailwind/TS configuration | Build | ✅ hand-written config | [next.config.js](web/next.config.js) · [tailwind.config.js](web/tailwind.config.js) · tsconfig.json (local only, not in git) |
| Security policy | Docs | ✅ written here (broader than the code) | [SECURITY.md](docs/SECURITY.md) |
| Google Maps services client, Prisma, Zod, date-fns | Dependencies | third-party npm | [package.json](web/package.json) |
| Android build config + manifest | Mobile | ⬜ config only — zero Kotlin | [android/](android/) |
| Web UI (pages, components, hooks, styles) | Frontend | ⬜ empty local directories, not in git | [web/src/](web/src) |
| Separate `backend/` (first-layout plan) | — | ⬜ five empty local directories, not in git | — |
| Auth (`next-auth`, `User` model, secret) | — | ⬜ installed, modeled, unwired | [package.json](web/package.json) · [schema.prisma](web/prisma/schema.prisma) |

---

## The numbers that matter

| Value | What it is |
|---|---|
| 7 days | `FRESH_THRESHOLD` — below it a location is `fresh`, at or above it `overdue` |
| 14 days | `WARNING_THRESHOLD` — defined, exported, never read; `'warning'` is unreachable |
| 1 / 10 | `BoxChange` rows fetched per location: listing (`take: 1`) vs detail (`take: 10`) |
| 3 | HTTP endpoints (4 handlers: GET+POST locations, POST mark-changed, POST optimize) |
| 983 | lines of TypeScript in `web/src` — the entire implemented platform |
| 5 + 1 | Prisma models + enum; 2 tables are ever written (`locations`, `box_changes`) |
| ±90 / ±180 | Zod bounds on latitude / longitude, re-checked by `isValidCoordinates` |
| 3,959 mi | Earth radius in the haversine fallback (implemented, never called) |
| N + 1 | legs in every optimize response — `destination: origin` always adds the return leg |
| 400 / 404 / 409 / 503 / 500 | error statuses: Zod, "Record to update not found", "Unique constraint", Maps failure, everything else |
| 3000 | dev-server port; the Android template points `API_BASE_URL` at `localhost:3000/api` |
| 24 → 34 | Android min → compile/target SDK (Kotlin 1.9.10, Compose 1.5.4, AGP 8.1.2) |
| 0 | Kotlin files, web pages, tests, and auth checks |

---

## Verification / testing status

**There are no tests.** No test directory, no test runner in
[package.json](web/package.json) (the closest is `type-check`, a bare
`tsc --noEmit`), no CI configuration, and no seed data — `npm run db:seed`
points at a `prisma/seed.ts` that does not exist. A local, gitignored
`web/.next/` directory (not in the repository) holds development-server
output, the only executable evidence that the API was actually run;
validation was evidently manual,
against a hand-populated database, in the style of the example request bodies
that the route files carry in their doc comments. The sharpest consequences:
the text-parsing bugs in the optimizer's totals and the empty-body 500 on
`mark-changed` are exactly the kind of edge a first integration test would
have caught.

---

## Design trade-offs & sharp edges

- **Derived status over stored status** — nothing to sync, no background
  jobs, and the 7-day boundary is crossed "for free" on the next read; in
  exchange, overdue filtering happens in JS over the full table, and every
  client pays the computation on every request. At this system's scale
  (a charity's box locations) the trade is clearly right.
- **Address strings over coordinates as the Google interface** — human-legible
  requests and no geocoding step, but it makes the address field a *join key*
  (exact-equality mapping back from `waypoint_order`) and leaves the stored
  `latitude`/`longitude` — validated at creation to ±90/±180 — unused by the
  optimizer. The geocoder that would bridge the two exists in
  [utils.ts](web/src/lib/utils.ts) and is never called.
- **Display-text parsing over numeric fields** — the legs' `distance.value` /
  `duration.value` (meters/seconds) are available in the same response the
  code already holds; parsing `"3.2 mi"` instead breaks on feet (`"528 ft"` →
  528 mi) and on hours (`"1 hour 12 mins"` → 1 min). This is the system's
  most consequential latent bug.
- **A wide controller behind a narrow API** — building update/delete/batch/
  analytics logic before their routes made the controller a complete
  statement of intent, but it means the deployed system cannot edit or delete
  a location, and dead surface (plus `calculateDrivingDistances`, imported
  and unused) reads as live.
- **Secrets hygiene held in git** — [SECURITY.md](docs/SECURITY.md) and a
  thorough `.gitignore` kept `web/.env` out of every commit; the remaining
  risk is the local, gitignored copy, which holds a live-looking Maps key,
  NextAuth secret, and database password. Rotate them if that folder was
  ever shared, and before any deployment.
- **Scaffold as roadmap** — the empty `backend/` tree, the source-less Android
  Gradle build (which cannot compile: no `settings.gradle`, no wrapper, no
  `MainActivity`, no `res/`), the empty UI directories, and the dormant
  `Route`/`RouteStop`/`User` tables are all *declared intent*. They document
  the plan honestly, at the cost of a working copy where most directories are
  load-bearing only in spirit — including the literal `{app/…}` directories
  left by a comma-less outer brace in a `mkdir -p` (kept as literal text),
  whose names (plus two real empty package dirs, `ui/locations` and
  `ui/toggle`, under `java/com/charity/`) are the fullest spec of the
  Android package layout. Being empty, none of
  those directories is tracked by git, so a clone of the repository has none
  of them.

---

## Provenance

A solo project — no teammates, course, or organization is credited anywhere
in the repository. Judged by file content: all TypeScript under
[web/src/](web/src), the Prisma schema, the Android Gradle/manifest
configuration, and [docs/SECURITY.md](docs/SECURITY.md) are project-authored
(the only generated file is `next-env.d.ts`; there is no starter-kit
boilerplate beyond what `create-next-app`-era conventions suggest). Built on
**Next.js 14**, **Prisma 5**, **Zod**, **@googlemaps/google-maps-services-js**,
**date-fns**, and **Tailwind** (config only), with the planned Android client
specified against **Jetpack Compose**, **Retrofit**, and **Room**. GitHub:
[KuyaBasti/CharityBusiness](https://github.com/KuyaBasti/CharityBusiness).
