# board-app

Design logical data models on boards: A4 pages on a zoomable canvas, table figures with
PK/FK columns, and crow's foot relations. See [SPEC.md](SPEC.md) for what's in v1.

## Run it (Docker)

Requires Docker with the Compose plugin (on Windows: Docker Desktop with WSL integration,
or Docker Engine installed inside WSL).

```bash
docker compose up -d --build
```

Open <http://localhost:3000>.

- Your data is stored in `./data/postgres` (next to `docker-compose.yml`).
  Keep the repo inside the WSL filesystem (e.g. `~/board-app`), not under `/mnt/c/...`,
  otherwise Postgres can run into file-permission problems.
- Stop: `docker compose down` (data is kept). Update after pulling changes: `docker compose up -d --build`.
- Backup: `docker compose exec db pg_dump -U board board > backup.sql`.

### Build fails at `npm ci` ("Exit handler never called")

The build container can't reach the npm registry. Check from WSL:

```bash
docker run --rm --network host node:22-alpine sh -c "wget -qO- https://registry.npmjs.org/svelte | head -c 80"
```

- No output / timeout → Docker has no internet inside containers (DNS, VPN or corporate proxy).
  Try restarting Docker / WSL (`wsl --shutdown` from Windows), and disconnect from VPN while building.
- Certificate error → a corporate proxy inspects HTTPS (common on work laptops). Put the company
  root certificate in `certs/` and build again:
  1. In Windows, press Win+R → `certmgr.msc` → *Trusted Root Certification Authorities* → *Certificates*.
  2. Find your company's / proxy's root (e.g. "Zscaler Root CA", or your company name).
  3. Right-click → *All Tasks* → *Export…* → **Base-64 encoded X.509 (.CER)**.
  4. Copy it into the repo: `cp /mnt/c/Users/<you>/Downloads/<file>.cer certs/company-root.crt`
  5. `docker compose build --no-cache app && docker compose up -d`

  The build log shows `Extra CA certificates: 1` when it's picked up.

## Import / export JSON

- **Import** (left bar): paste JSON, drop or pick a `.json` file. The app checks it first and lists every
  problem; nothing is imported unless it's fully valid. One `Ctrl+Z` undoes the whole import.
- **Export ▾** (top-left): the whole board or one page, in the same format, so you can re-import it.
- Format: [`static/board-import.schema.json`](static/board-import.schema.json) (JSON Schema, also served at
  <http://localhost:3000/board-import.schema.json>). Example: [`examples/webshop.json`](examples/webshop.json).
- **🤖 Copy AI prompt** in the import dialog copies instructions + the schema; paste it into ChatGPT/Claude,
  describe your model, and import the answer.

Minimal example:

```json
{
  "page": "Sales",
  "tables": [
    { "name": "customer", "columns": [ { "name": "id", "type": "integer", "key": "PK" } ] },
    { "name": "order", "columns": [
      { "name": "id", "type": "integer", "key": "PK" },
      { "name": "customer_id", "type": "integer", "key": "FK" }
    ]}
  ],
  "relations": [ { "from": "order.customer_id", "to": "customer.id" } ]
}
```

Rules worth knowing:
- `key` is `"PK"`, `"FK"` or `"PK+FK"` (or use `"pk": true` / `"fk": true`).
- Relations are `"table.column"` on the same page; cardinality defaults to many (`from`) to one (`to`).
  Short forms `1`, `0..1`, `1..*`, `0..*` work too.
- Tables without `x`/`y` are laid out automatically; the page gets the smallest paper size that fits.
- Several pages: `{ "pages": [ { "page": "…", "tables": […] }, … ] }` (always imported as new pages).
- Importing into an existing page with tables of the same name asks: skip, replace or add copies.

## Develop

```bash
docker compose up -d db                     # or any local Postgres
npm install
DATABASE_URL=postgres://board:board@localhost:5432/board npm run dev
```

For local dev, expose the database by adding `ports: ["127.0.0.1:5432:5432"]` to the `db` service.

## Using the editor

| Action | How |
| --- | --- |
| Select / Hand tool | Top bar, or `V` / `H`; hold `Space` for Hand temporarily |
| Select several | Drag a box on the background, Shift+click, or `Ctrl+A` |
| New page | `+ Page` (top-left) |
| Move a page | Select tool: drag the page (or its title) |
| Resize a page | Select it and drag its edges/corners, or pick a paper size in its header |
| Rename page / table / board | Double-click the name (boards also have ✏️) |
| Add table | Table tool in the left bar, then click on a page (`Esc` cancels) |
| Add / delete a row | `+` under the table / `×` on hover |
| Set key | Click the key cell: none → PK → FK → PK+FK |
| Draw a relation | Drag from a dot on a row's left/right edge to another row on the same page |
| Cardinality | Click a relation; pick each end at the bottom |
| Delete | Select and press `Delete` / `Backspace` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Zoom / pan | Mouse wheel / Hand tool, Space+drag or middle mouse; click the zoom % to fit |
