# Requirements: Mint AI — Remaining Phases (2-4)

## Phase 2: Library + Polish

### Requirement 1: Enhanced Library Grid

**User Story**: As a user, I want to see my apps displayed as rich cards with thumbnails and metadata so I can quickly find and open the app I need.

**Acceptance Criteria**:
- 1.1 Library grid displays app cards with thumbnail previews; cards without thumbnails show a gradient placeholder
- 1.2 App cards show title, description (2-line clamp), up to 3 tag chips, and relative "last updated" time
- 1.3 Search input filters apps by title, description, prompt, and tags (case-insensitive, debounced 300ms)
- 1.4 Tag filter chips (derived from all apps' tags) narrow results to apps containing the selected tag
- 1.5 Library sorts by updatedAt descending by default

### Requirement 2: App Detail Page

**User Story**: As a user, I want a dedicated view for a single app where I can preview it, see its history, share it, and modify it.

**Acceptance Criteria**:
- 2.1 App detail page shows full-width iframe preview with the app's HTML
- 2.2 Detail page displays title, description, tags, created date, updated date, and version number
- 2.3 Detail page has action buttons: Back, Modify (focuses prompt bar), Share (opens ShareDialog), Export (.html download), Fullscreen
- 2.4 Clicking "Modify" from detail page sets the app as currentApp and focuses the prompt bar with contextual placeholder

### Requirement 3: Version History

**User Story**: As a user, I want to see all versions of my app and roll back to any previous version without losing history.

**Acceptance Criteria**:
- 3.1 Version history panel displays a vertical timeline of all versions for the current app
- 3.2 Each version entry shows: version number, prompt used, and relative timestamp
- 3.3 Clicking "Rollback" on a version creates a new version (current + 1) with that version's HTML; no history is deleted
- 3.4 After rollback, the app preview updates to show the restored HTML
- 3.5 Version history is fetched from the IndexedDB `history` store via the `appId` index

### Requirement 4: Iteration UX

**User Story**: As a user, I want to modify my existing app through a conversation-like flow where each modification builds on the previous version.

**Acceptance Criteria**:
- 4.1 When an app is selected (currentApp is set), the prompt bar placeholder changes to `Modify "{app.title}"...`
- 4.2 Submitting a prompt with currentApp set sends the existing HTML as context to the LLM
- 4.3 After modification, the app's version increments and a new version record is saved to history
- 4.4 The user can clear the current app context by clicking "New" or navigating to library

### Requirement 5: Thumbnail Capture

**User Story**: As a user, I want my apps to have visual thumbnails in the library so I can recognize them at a glance.

**Acceptance Criteria**:
- 5.1 After generation completes and preview is stable (500ms delay), a thumbnail is captured from the iframe
- 5.2 Thumbnails are 400×300 PNG images encoded as base64 data URLs
- 5.3 Thumbnails exceeding 64KB are discarded (app.thumbnail set to null)
- 5.4 Thumbnail capture failure is silent — no error shown to user, gradient placeholder used instead

### Requirement 6: 3D Animated Background

**User Story**: As a user, I want a visually striking 3D animated background that makes the app feel premium and polished.

**Acceptance Criteria**:
- 6.1 A Threlte (Three.js for Svelte) component renders a subtle animated mesh gradient or particle field behind all content
- 6.2 The background responds to mouse movement with subtle parallax effect
- 6.3 During generation (isGenerating = true), background intensity is reduced to save GPU resources
- 6.4 If WebGL is unavailable, the background falls back to a CSS animated gradient silently
- 6.5 The background respects `prefers-reduced-motion` media query

### Requirement 7: Glass Morphism Polish + Animations

**User Story**: As a user, I want smooth transitions and polished glass morphism effects throughout the UI.

**Acceptance Criteria**:
- 7.1 View transitions (library → detail → preview) use smooth fade/slide animations
- 7.2 App cards have hover scale effect (1.02x) with glass border glow
- 7.3 Modals (settings, share) use slide-up animation on open and fade-out on close
- 7.4 All animations respect `prefers-reduced-motion`

---

## Phase 3: Sharing + Gallery

### Requirement 8: Share Dialog

**User Story**: As a user, I want to share my apps via link, Gist, or file download from a single dialog.

**Acceptance Criteria**:
- 8.1 Share dialog opens as a modal with three sharing options: URL Link, GitHub Gist, and Download
- 8.2 For apps whose compressed size is under 50KB, a URL fragment link is generated and copyable
- 8.3 For larger apps (or by user choice), GitHub Gist sharing is available after entering a GitHub token
- 8.4 The GitHub token is stored in localStorage only, never in IndexedDB
- 8.5 Download option exports the app as a standalone .html file (existing functionality, surfaced in dialog)
- 8.6 Copy-to-clipboard shows a brief "Copied!" confirmation

### Requirement 9: GitHub Gist Integration

**User Story**: As a user, I want to share large apps via GitHub Gist so they can be accessed by anyone with the link.

**Acceptance Criteria**:
- 9.1 `createGist()` sends a POST to `https://api.github.com/gists` with the app HTML as a single file
- 9.2 The Gist is created as public with the filename `{app.title}.html`
- 9.3 On success, the Gist URL and raw content URL are returned
- 9.4 On failure (401, 403, 422, network error), a descriptive error message is shown in the dialog
- 9.5 The app's `shareId` is updated with the Gist URL after successful creation

### Requirement 10: Fork/Remix Flow

**User Story**: As a user, I want to fork a shared or gallery app into my library so I can modify it as my own.

**Acceptance Criteria**:
- 10.1 Fork creates a new app with `crypto.randomUUID()` id, `version: 1`, and `forkedFrom` set to source ID or URL
- 10.2 The forked app's HTML is identical to the source app's HTML
- 10.3 The forked app is saved to IndexedDB with a version 1 history record
- 10.4 After forking, the user is navigated to the forked app's detail/preview page
- 10.5 Forking a gallery app or shared link does not require the source to be in the user's library

### Requirement 11: Static Gallery

**User Story**: As a user, I want to browse a curated gallery of demo apps for inspiration and to fork into my library.

**Acceptance Criteria**:
- 11.1 Gallery data is loaded from a static `public/gallery.json` file bundled at build time
- 11.2 Gallery page displays apps in a grid with thumbnails, titles, descriptions, and tags
- 11.3 Gallery supports search and tag filtering (reusing the same searchApps logic)
- 11.4 Each gallery app has a "Fork" button that triggers the fork/remix flow
- 11.5 Gallery apps are sorted with featured apps first, then by createdAt descending

### Requirement 12: PWA Support

**User Story**: As a user, I want to install Mint AI as a PWA so I can access my library offline and launch it from my home screen.

**Acceptance Criteria**:
- 12.1 A valid `manifest.json` is served with app name, icons, theme color (#22c55e), and display: standalone
- 12.2 A service worker caches the app shell (HTML, CSS, JS, fonts) for offline access
- 12.3 The library view works offline using cached IndexedDB data
- 12.4 Generation requires network (LLM API) — offline mode shows a clear message when generation is attempted
- 12.5 The service worker updates on new deployments with a "New version available" prompt

---

## Phase 4: YC-Ready Polish

### Requirement 13: Landing Page

**User Story**: As a visitor, I want to see a compelling landing page that explains what Mint AI does and lets me try it immediately.

**Acceptance Criteria**:
- 13.1 Landing page is a separate Astro page (`/landing` or root with redirect) with hero section, value proposition, and CTA
- 13.2 Hero section has the 3D background, app title with gradient text, and a tagline
- 13.3 CTA button navigates to the main app view
- 13.4 Landing page includes 2-3 demo app screenshots or animated previews
- 13.5 Landing page is server-rendered (static HTML) for fast load and SEO

### Requirement 14: Onboarding Wizard

**User Story**: As a first-time user, I want a guided setup experience so I can configure my LLM provider and understand how Mint AI works.

**Acceptance Criteria**:
- 14.1 On first visit (no onboarding state in localStorage), the wizard modal appears automatically
- 14.2 Step 1: Welcome screen with value proposition and "Get Started" button
- 14.3 Step 2: Provider selection with guided API key entry (pre-filled defaults for DeepSeek)
- 14.4 Step 3: Optional test generation with a sample prompt to verify setup
- 14.5 Wizard can be skipped at any step; skipped state is persisted
- 14.6 Wizard does not appear again after completion or skip (checked via localStorage)

### Requirement 15: Mobile Optimization

**User Story**: As a mobile user, I want the app to be fully usable on my phone with touch-friendly controls.

**Acceptance Criteria**:
- 15.1 All interactive elements have minimum 44px touch targets
- 15.2 Library grid collapses to single column on mobile viewports (< 640px)
- 15.3 Prompt bar is fixed at bottom and doesn't overlap with mobile keyboard
- 15.4 Share dialog and settings modal are full-width on mobile
- 15.5 3D background is disabled or minimal on mobile to save battery

### Requirement 16: Auto-Retry on JS Errors

**User Story**: As a user, I want the system to automatically fix JavaScript errors in generated apps so I get working results more often.

**Acceptance Criteria**:
- 16.1 After generation, the app is rendered in a hidden iframe and console errors are captured for 3 seconds
- 16.2 If JS errors are detected, the system automatically sends the HTML and error messages back to the LLM with a fix prompt
- 16.3 Auto-retry runs a maximum of 2 times (MAX_RETRIES = 2)
- 16.4 Each retry shows a status indicator: "Auto-fix attempt 1/2..." in the stream view
- 16.5 If errors persist after all retries, the app is shown with a subtle warning: "This app may have issues"
- 16.6 The retry prompt includes the specific error messages and the full HTML for context

### Requirement 17: Library Search and Filter

**User Story**: As a user with many apps, I want to search and filter my library to quickly find what I need.

**Acceptance Criteria**:
- 17.1 Search input at the top of the library view with debounced input (300ms)
- 17.2 Search matches against title, description, prompt, and tags (case-insensitive)
- 17.3 Tag filter chips are displayed below the search bar, derived from all unique tags across apps
- 17.4 Selecting a tag chip filters results; selecting again deselects it
- 17.5 Search and tag filter combine (AND logic): results must match both query and selected tag
- 17.6 Empty search with no tag filter shows all apps

### Requirement 18: OG Images for Shared Apps

**User Story**: As a user sharing an app link, I want the link preview to show a rich card with the app's title and thumbnail.

**Acceptance Criteria**:
- 18.1 Shared app URLs include Open Graph meta tags (og:title, og:description, og:image)
- 18.2 OG image is either the app's thumbnail or a generic Mint AI branded image
- 18.3 Meta tags are injected into the HTML when generating share links
