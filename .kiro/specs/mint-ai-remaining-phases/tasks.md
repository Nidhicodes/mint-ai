# Tasks: Mint AI — Remaining Phases (2-4)

## Phase 2: Library + Polish

- [x] 1. Enhanced Library Grid (Req 1, 5, 7)
  - [x] 1.1 Create `SearchFilter.svelte` component with debounced search input (300ms) and tag filter chips derived from all apps' tags
  - [x] 1.2 Implement `searchApps()` function in `src/lib/search.ts` — case-insensitive search across title, description, prompt, tags with AND tag filter logic
  - [x] 1.3 Refactor library view in `MintApp.svelte` to use SearchFilter and display enhanced app cards with thumbnail (or gradient placeholder), title, description (2-line clamp), up to 3 tag chips, and relative "updated" time
  - [x] 1.4 Add hover scale (1.02x) and glass border glow animations to app cards; ensure all animations respect `prefers-reduced-motion`
  - [x] 1.5 Write property tests (fast-check) for `searchApps`: empty query returns all, results are subset, case-insensitive matching, tag filter narrows correctly

- [x] 2. Thumbnail Capture (Req 5)
  - [x] 2.1 Create `src/lib/storage/thumbnails.ts` with `captureThumbnail(iframe)` — renders iframe content to 400×300 canvas via SVG foreignObject, returns base64 PNG ≤ 64KB or null
  - [x] 2.2 Integrate thumbnail capture into generation flow: after preview is stable (500ms delay), capture and save to app record in IndexedDB
  - [x] 2.3 Write unit tests for thumbnail size bound (≤ 64KB or null) and graceful failure on invalid iframe

- [x] 3. App Detail Page (Req 2, 4)
  - [x] 3.1 Create `AppDetail.svelte` component with full-width iframe preview, metadata display (title, description, tags, dates, version), and action buttons (Back, Modify, Share, Export, Fullscreen)
  - [x] 3.2 Wire "Modify" button to set currentApp and focus prompt bar with contextual placeholder; wire "Back" to return to library
  - [x] 3.3 Add view routing in `MintApp.svelte` for the new `detail` view state, navigating from library card click → detail instead of directly to preview

- [x] 4. Version History (Req 3)
  - [x] 4.1 Create `VersionHistory.svelte` component with vertical timeline displaying version number, prompt, and relative timestamp for each version
  - [x] 4.2 Implement `rollbackToVersion()` in `src/lib/storage/db.ts` — creates new version (current + 1) with target version's HTML, saves both app and version records
  - [x] 4.3 Integrate VersionHistory panel into AppDetail page with rollback button per version entry
  - [x] 4.4 Write property tests for rollback: version always increases, history length increases by 1, HTML matches target version

- [x] 5. 3D Animated Background (Req 6)
  - [x] 5.1 Install Threlte dependencies (`@threlte/core`, `@threlte/extras`, `three`) and configure Astro/Svelte for Three.js
  - [x] 5.2 Create `ThrelteBackground.svelte` with animated mesh gradient or particle field; add mouse-move parallax effect
  - [x] 5.3 Add WebGL feature detection — fall back to CSS animated gradient if unavailable
  - [x] 5.4 Reduce background intensity when `isGenerating` is true; respect `prefers-reduced-motion` media query

- [x] 6. Iteration UX Polish (Req 4, 7)
  - [x] 6.1 Update prompt bar to show contextual placeholder when currentApp is set (`Modify "{title}"...`) and "Modify" button label
  - [x] 6.2 Ensure each modification increments version and saves a new version record to history store
  - [x] 6.3 Add slide-up animation to modals (settings, share) and fade transitions between views (library ↔ detail ↔ preview)

---

## Phase 3: Sharing + Gallery

- [x] 7. Share Dialog (Req 8)
  - [x] 7.1 Create `ShareDialog.svelte` modal with three tabs/sections: URL Link, GitHub Gist, Download
  - [x] 7.2 Implement URL fragment link generation for small apps (< 50KB compressed) with copy-to-clipboard and "Copied!" feedback
  - [x] 7.3 Add download option using existing `downloadHtml()` function surfaced in the dialog UI

- [x] 8. GitHub Gist Integration (Req 9)
  - [x] 8.1 Create `src/lib/sharing/gist.ts` with `createGist(html, title, token)` — POST to GitHub API, return gist URL and raw URL
  - [x] 8.2 Add GitHub token input to ShareDialog Gist section; store token in localStorage only
  - [x] 8.3 Handle Gist API errors (401, 403, 422, network) with descriptive messages in the dialog
  - [x] 8.4 Update app's `shareId` field in IndexedDB after successful Gist creation
  - [x] 8.5 Write unit tests for `createGist` with mocked fetch (success, auth failure, network error)

- [x] 9. Fork/Remix Flow (Req 10)
  - [x] 9.1 Create `src/lib/sharing/fork.ts` with `forkApp(source, origin)` — creates new app with fresh UUID, forkedFrom set, version 1, saves to IndexedDB with history record
  - [x] 9.2 Add "Fork" button to shared app view and gallery app cards; navigate to forked app after creation
  - [x] 9.3 Write property tests for forkApp: new ID ≠ source ID, HTML identical, forkedFrom set, version is 1

- [x] 10. Static Gallery (Req 11)
  - [x] 10.1 Create `public/gallery.json` with 5-8 curated demo apps (title, description, tags, HTML, thumbnail URL, featured flag)
  - [x] 10.2 Create `src/lib/gallery/loader.ts` with `loadGallery()` — fetches and parses gallery.json, sorts featured first then by createdAt
  - [x] 10.3 Create gallery view (new route or tab in MintApp) with app grid, search, tag filter, and "Fork" button per app
  - [x] 10.4 Write unit tests for `loadGallery` with mock JSON (valid manifest, malformed JSON, empty apps)

- [x] 11. PWA Support (Req 12)
  - [x] 11.1 Create `public/manifest.json` with app name, icons (192px, 512px), theme color (#22c55e), background color (#0a0a0a), display: standalone
  - [x] 11.2 Create service worker (`public/sw.js`) that caches app shell assets on install and serves from cache on fetch
  - [x] 11.3 Add service worker registration in `src/lib/pwa/sw-register.ts`; add manifest link to Layout.astro
  - [x] 11.4 Show "Generation requires internet" message when offline and user attempts to generate
  - [x] 11.5 Add "New version available" update prompt when service worker detects a new deployment

---

## Phase 4: YC-Ready Polish

- [x] 12. Landing Page (Req 13)
  - [x] 12.1 Create `src/pages/landing.astro` with hero section (3D background, gradient title, tagline), value proposition, and CTA button linking to main app
  - [x] 12.2 Add 2-3 demo app screenshots or animated preview section below the hero
  - [x] 12.3 Configure routing: landing page at `/` for new visitors, app at `/app`; or use landing as the default with scroll-to-app

- [x] 13. Onboarding Wizard (Req 14)
  - [x] 13.1 Create `OnboardingWizard.svelte` with 3 steps: Welcome, Provider Setup (pre-filled DeepSeek defaults), Optional Test Generation
  - [x] 13.2 Add skip button on each step; persist onboarding state (`completed`, `skipped`, `completedAt`) to localStorage
  - [x] 13.3 Show wizard automatically on first visit (no onboarding state in localStorage); never show again after completion or skip
  - [x] 13.4 Write unit tests for onboarding state logic: first visit shows wizard, completed hides it, skipped hides it

- [x] 14. Mobile Optimization (Req 15)
  - [x] 14.1 Audit and fix all interactive elements to have ≥ 44px touch targets; collapse library grid to single column on < 640px
  - [x] 14.2 Fix prompt bar positioning to avoid overlap with mobile keyboard (use `visualViewport` API or CSS `env(safe-area-inset-bottom)`)
  - [x] 14.3 Make share dialog and settings modal full-width on mobile viewports
  - [x] 14.4 Disable or minimize 3D background on mobile devices (detect via `matchMedia` or touch capability)

- [x] 15. Auto-Retry on JS Errors (Req 16)
  - [x] 15.1 Create `src/lib/engine/autoretry.ts` with `renderAndCaptureErrors(html, timeout)` — renders HTML in hidden iframe, captures console.error output for `timeout` ms
  - [x] 15.2 Implement `generateWithRetry()` wrapping existing `generate()` — on JS errors, build fix prompt with error context and HTML, retry up to MAX_RETRIES (2)
  - [x] 15.3 Add retry status indicators to stream view ("Auto-fix attempt 1/2...") and warning banner if errors persist after all retries
  - [x] 15.4 Integrate `generateWithRetry` into `MintApp.svelte` handleGenerate flow, replacing direct `generate()` call
  - [x] 15.5 Write property tests: retry count never exceeds MAX_RETRIES; example tests: clean HTML → no retries, errored HTML → retries with error context in prompt

- [x] 16. Library Search/Filter UI (Req 17)
  - [x] 16.1 Wire SearchFilter component (from task 1.1) into the library view header with persistent state across view transitions
  - [x] 16.2 Ensure tag chips toggle on/off (selecting again deselects) and combine with search query via AND logic
  - [x] 16.3 Show "No apps found" empty state when search/filter yields zero results

- [x] 17. OG Images for Shared Apps (Req 18)
  - [x] 17.1 When generating share links, inject `<meta property="og:title">`, `<meta property="og:description">`, and `<meta property="og:image">` tags into the shared HTML
  - [x] 17.2 Use app thumbnail as og:image if available; fall back to a generic Mint AI branded image (`public/og-default.png`)
  - [x] 17.3 Create the default OG image asset (`public/og-default.png`) — 1200×630 with Mint AI branding
