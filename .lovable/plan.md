## Goal

Keep the two tabs (**Reports** / **Builder**) but make each one feel purposeful instead of cramped and generic. Scope: `src/routes/_authenticated/admin.reports.tsx` only.

## What's wrong today

- **Header is generic.** "Approve submitted reports, or build & export custom ones." tries to describe two unrelated jobs at once. The "Save as template" CTA sits in the header even when the Reports tab is open.
- **Reports (approvals) tab is just a flat list.** No totals across the queue, no sense of how much money / how many flags are waiting on the admin, no sort, no search. The "draft" filter doesn't belong here (drafts aren't admin work).
- **Builder is 3 stacked control bars before any data.** 8 filters in a 4‑col grid → separate Columns/Sort bar → preview. Preview itself is text-only: a Rows stat, a Total stat, then a table. No chart, no top-N callouts, no breakdown — the whole point of a report builder.
- **Saved templates vs starter presets** compete in the same sidebar with identical styling; it's unclear which is "yours".
- **Save flow** uses a full overlay modal for "name it and hit enter".

## Changes

### 1. Header + tab strip
- Drop the "ADMIN" eyebrow (redundant with sidebar) and the two-job subtitle.
- Title becomes **"Reports"**, subtitle changes per active tab ("Approve and track submitted reports" / "Build, save, and export custom views").
- Move **New / Save** actions out of the page header and into the Builder tab's own toolbar so they only appear when relevant.
- Tab strip: add a count badge on **Reports** showing pending-submitted count, so admins immediately see workload.

### 2. Reports (approvals) tab
- Add a 3-up **summary strip** above the filter pills: *Awaiting decision* (count + total $), *Approved this month* (count + $), *Flags on pending* (count). Uses existing `data` — no new server fn.
- Replace tag-style filter pills with a cleaner segmented control; drop **Draft** (not admin's job), keep All / Pending / Approved / Reimbursed / Rejected. Add a search input (filter by submitter name / title).
- Card list: tighten padding, move amount + status to a single right column, make Review/Approve/Reject row right-aligned and smaller. Empty state per filter is more helpful ("Nothing pending — you're caught up.").
- Default sort: pending first (by submitted_at desc), then others by decided_at desc.

### 3. Builder tab
- Collapse the two control rows into **one card** with two sections: *Scope* (date / status / group by / row limit) on top, *Filters* (employees / categories / trips / amount + flags) collapsible underneath. Default collapsed when no filters active so the page breathes.
- Move Columns + Sort into a **small toolbar above the preview** (right-aligned chip group + sort dropdown), not a separate full-width card.
- **Preview panel upgrade:**
  - Header row keeps name, range, exports.
  - Add a **summary band**: Total, Rows, Avg, Top group (when grouped). Mixed-currency note shown inline.
  - Add a lightweight **inline bar chart** (top 8 of the current group, or top 8 employees/categories when ungrouped). Uses Recharts (already in stack if available; otherwise SVG bars — confirm during impl).
  - Table sits below, same as today.
- **Sidebar:** visually separate **Saved templates** (your work, primary) from **Starter presets** (secondary, under a faint divider, smaller type). Saved templates get a subtle "last used" timestamp.
- Replace the modal save dialog with an **inline rename + save** in the builder toolbar (popover anchored to the Save button). Enter saves, Esc cancels.

### 4. Polish
- Consistent border radius (drop the 3xl/2xl mix — settle on `rounded-2xl` for cards, `rounded-xl` for inner elements).
- Tighten vertical rhythm: `space-y-4` between cards instead of `space-y-5` + `mt-7`.
- Sticky preview header inside its scroll container so totals stay visible while scrolling rows.
- All copy passes for tone (shorter, action-led).

## Out of scope

- No new server functions, no schema changes, no new routes.
- No scheduling / shareable links (you skipped that question).
- No charts beyond the single inline bar chart in preview.
- Other admin pages (`admin.index`, `admin.users`, `admin.reimburse`) untouched.

## Files

- `src/routes/_authenticated/admin.reports.tsx` — all changes here.
- Possibly add a tiny `<MiniBar />` helper inline (no new file) for the preview chart.
