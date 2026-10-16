# Board App — Spec (v1)

A web app for designing logical data models on boards. Single user, runs locally via Docker.

## Concepts

- **Board**: top-level entity. Has a name, an emoji icon and a "last edited" timestamp.
  Boards are listed in a side pane (sorted by last edited) with a search box on board name.
- **Page**: an A4 landscape frame on a board's infinite, zoomable canvas. Has a title.
  Pages can be positioned anywhere but may not overlap (they snap apart when dropped on each other).
- **Table**: a design figure that lives on exactly one page and cannot leave it.
  It has a title and rows. Each row has three cells:
  1. **Key**: click cycles `blank → PK → FK → PK+FK` (set manually; composite PKs = several PK rows).
  2. **Name**
  3. **Datatype** (free text — conceptual, logical or physical, up to you).
  Rows are added with a `+` button and can be deleted.
- **Relation**: an angular (orthogonal) line drawn by hand from one row to another row
  **on the same page** (self-references allowed). Each end has crow's foot cardinality:
  one, zero-or-one, one-or-many, zero-or-many. New relations default to many-to-one.
  Drawing a relation never changes key badges or creates rows.

## Interaction

- Mouse wheel zooms; dragging the empty canvas (or a page body) pans.
- Pages are dragged by their header. Tables are dragged by their title bar.
- Undo / redo per board: `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`).
- `Delete` / `Backspace` deletes the selection. Deleting a board or page asks for confirmation;
  tables, rows and relations do not (use undo).
- Changes autosave ~1 second after the last edit.

## Architecture

- **app** container: SvelteKit (Svelte 5 + TypeScript) with Svelte Flow for the canvas.
  Serves the UI and a JSON API on `http://localhost:3000`.
- **db** container: PostgreSQL 16, data bind-mounted to `./data/postgres`. Not exposed to the host.
- Storage: one row per board — `id, name, emoji, updated_at, content (JSONB)`.
  `content` holds the board's pages, tables and relations as one document.

## Out of scope for v1

Flowcharts, multi-user/login, SQL generation, export/import, row reordering, table colours.
