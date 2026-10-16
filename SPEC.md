# Board App — Spec (v1)

A web app for designing logical data models on boards. Single user, runs locally via Docker.

## Concepts

- **Board**: top-level entity. Has a name, an emoji icon and a "last edited" timestamp.
  Boards are listed in a side pane (sorted by last edited) with a search box on board name.
- **Page**: a frame on a board's infinite, zoomable canvas. Has a title. New pages are A4 landscape;
  pages can be resized by dragging (when selected) or set to A4–A1 portrait/landscape. A page can't
  shrink smaller than its tables. Pages can be positioned anywhere but may not overlap (they snap apart).
- **Table**: a design figure that lives on exactly one page and cannot leave it.
  It has a title and rows. Each row has three cells:
  1. **Key**: click cycles `blank → PK → FK → PK+FK` (set manually; composite PKs = several PK rows).
  2. **Name**
  3. **Datatype** (free text — conceptual, logical or physical, up to you).
  Rows are added with a `+` button and can be deleted.
  Tables have a heading colour (palette of 12 or any colour; default gray; text turns white on dark
  colours), a width (drag the sides, min 200 px) and a name/datatype split (drag the divider; kept
  proportionally when the width changes).
- **Relation**: an angular (orthogonal) line drawn by hand from one row to another row
  **on the same page** (self-references allowed). Each end has crow's foot cardinality:
  one, zero-or-one, one-or-many, zero-or-many. New relations default to many-to-one.
  Drawing a relation never changes key badges or creates rows.

- **Import / export**: JSON in a documented format (`static/board-import.schema.json`), by name
  (`"table.column"`), positions optional (auto-layout). Import validates everything first and is one undo
  step; export produces the same format for a page or the whole board.

## Interaction

- Top bar: **Select** (arrow, `V`) and **Hand** (`H`, or hold `Space`) tools, undo/redo, zoom %.
  - Select: drag on the background draws a selection box; click/drag pages and tables;
    Shift+click adds to the selection; `Ctrl+A` selects everything. Middle mouse pans.
  - Hand: dragging anywhere pans; nothing can be selected or edited.
- Left bar: object tools (for now **Table**): pick it, then click on a page to place the table.
- Mouse wheel zooms in every mode. Tables are dragged by their title bar.
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
