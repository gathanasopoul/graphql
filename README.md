# Zone01 GraphQL Profile

A lightweight web dashboard for viewing a Zone01 student profile using the platform's authentication and GraphQL APIs, built with vanilla HTML, CSS, JavaScript (ES modules), and inline SVG charts.

## Features

- **Authentication & Session Handling**
  - Sign in with either `username` or `email` and password via HTTP Basic authentication (`https://platform.zone01.gr/api/auth/signin`).
  - Stores the returned JWT in `localStorage` and attaches it as a `Bearer` token for GraphQL requests.
  - Displays inline error messages on invalid credentials or expired sessions, and provides a `Log out` action that clears session state and DOM data.
  - Dedicated loading state while profile, XP, skills, and evaluation data are fetched.

- **Profile Sections**
  1. **User Identification**: Displays student login and user ID.
  2. **Total XP**: Sums XP transactions (`type = "xp"`) in `kB` alongside total transaction count.
  3. **Audit Ratio**: Displays rounded audit ratio alongside `Done (Up)` and `Received (Down)` volumes in `MB`.
  4. **Statistical Graphs (SVG)**: Three interactive inline SVG charts.
  5. **Recent Evaluations** *(Bonus)*: Displays the 10 most recent `result` entries with `All`, `Pass`, `Fail`, and `In Progress` filters.

- **Interactive SVG Charts** (`charts.js`)
  - **XP Progression Over Time**: Chronological cumulative XP curve plotted on a time-proportional X-axis, with track filter pills (`All XP`, `div-01`, `piscine-go`, `piscine-js`, etc.), pointer crosshair scrubbing, hover tooltips, and click-to-pin milestone details.
  - **Audit Ratio Breakdown**: Horizontal comparison bars (`Done` vs `Received`), proportional volume split bar with `1.0` balance marker, hover inspection, and an interactive `MB` / `kB` / `Bytes` unit switcher.
  - **Skills**: Aggregates `skill_%` transactions by peak percentage with a `Radar` (top 8 skills) and `Bars` (all skills) view switcher, hover tooltips, and click-to-pin inspection.

## GraphQL Queries Used

All profile data is fetched in [`loadUserData`](app.js) from `https://platform.zone01.gr/api/graphql-engine/v1/graphql`, covering the three required query forms:

- **Normal query**: `user { id login auditRatio totalUp totalDown }`
- **Arguments**: `transaction(where: { type: { _eq: "xp" } }, order_by: { createdAt: asc })` and `transaction(where: { type: { _like: "skill_%" } }, order_by: { amount: desc })`
- **Nested query with arguments**: `result(limit: 10, order_by: { createdAt: desc }) { grade object { name type } }`

## Project Structure

```text
.
├── index.html   # Login view, loading screen, profile sections, and chart containers
├── style.css    # Responsive light-mode layout, tables, tooltips, and SVG chart styles
├── app.js       # Auth flow, JWT session management, GraphQL queries, and DOM rendering
├── charts.js    # Interactive SVG chart renderers (XP progression, audit ratio, skills)
└── README.md
```

## Running Locally

Because `index.html` loads `app.js` as an ES module (`<script type="module">`), serve the directory over HTTP rather than opening `index.html` directly via `file://`:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Deployment

This project consists solely of static frontend files (`index.html`, `style.css`, `app.js`, `charts.js`) with no build step, so it can be hosted directly on static hosting providers such as GitHub Pages or Netlify.

