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
| New page | `+ Page` (top-left) |
| Move a page | Drag its title |
| Rename page / table / board | Double-click the name |
| Add table | `+ Table` in the page header |
| Add / delete a row | `+` under the table / `×` on hover |
| Set key | Click the key cell: none → PK → FK → PK+FK |
| Draw a relation | Drag from a dot on a row's left/right edge to another row on the same page |
| Cardinality | Click a relation; pick each end at the top |
| Delete | Select and press `Delete` / `Backspace` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Zoom / pan | Mouse wheel / drag the background |
