# OSM region ingest

How WikiTraveler loads accommodation data from OpenStreetMap into the node database. Configure the region in **Admin** (`/stats`) → **Region & OSM ingest**.

For platform limits (Vercel vs Docker, tile caps, cron timing), see [DEPLOYMENT.md § Region & OSM ingest](./DEPLOYMENT.md#2c-bis-region--osm-ingest-admin) and the summary table in the [root README](../README.md#osm-ingest--pick-the-right-platform).

---

## Three ways to load OSM data

| Path | Best for | Server needs |
| --- | --- | --- |
| **Tiled Overpass** | Default — cities, countries, Benelux-scale regions (≤ ~150 tiles) | Any host; Vercel uses chunked cron |
| **Geofabrik PBF** | Large countries (France, Germany, …) on Docker/VPS | `osmium-tool`, long-running process |
| **GeoJSON upload** | You prepared an extract offline; upload to Vercel or skip Overpass | No osmium on server — only file upload |

All three ingest the **same accommodation types** as tiled Overpass (hotels, hostels, B&Bs, etc.).

---

## 1. Tiled Overpass (default)

1. Pick a preset or draw a bbox in Admin.
2. **Preview changes** → **Apply & ingest** (or **Re-ingest OSM data** if bbox unchanged).
3. Watch tile progress (`tile 1/128`, …).

CLI equivalent (uses admin-configured bbox from DB):

```bash
pnpm osm:ingest
```

---

## 2. Geofabrik PBF (Docker / VPS)

Large country presets in Admin, or CLI:

```bash
# Region bbox must match the Geofabrik preset in Admin first
pnpm osm:import-pbf --region france
pnpm osm:import-pbf --region germany
```

This downloads `{country}-latest.osm.pbf` from [Geofabrik](https://download.geofabrik.de/), runs `osmium tags-filter` + `osmium export`, and ingests into the DB. **Blocked on Vercel serverless** (no long-running osmium).

Docker dev/prod images include `osmium-tool`.

---

## 3. GeoJSON upload (manual osmium)

Use when:

- Overpass tiled ingest is too slow or rate-limited.
- The node runs on **Vercel** (no osmium) but you processed a extract on your laptop.
- You have a custom filtered export from osmium, QGIS, or another tool.

**Not for:** backup/restore, or re-importing auditor field work.

### Install osmium

| Platform | Command |
| --- | --- |
| Docker (WikiTraveler image) | Already installed in `docker/Dockerfile.dev` |
| Linux / WSL | `sudo apt install osmium-tool` |
| macOS | `brew install osmium-tool` |

Docs: [osmcode.org/osmium-tool](https://osmcode.org/osmium-tool/)

### Step 1 — Download a `.pbf` extract

From Geofabrik, e.g. Benelux:

```bash
curl -L -o benelux-latest.osm.pbf \
  https://download.geofabrik.de/europe/benelux-latest.osm.pbf
```

Pick a region that covers your Admin bbox.

### Step 2 — Filter to accommodations

WikiTraveler uses the same filter as `buildOsmiumAccommodationFilterArgs()` in `apps/node/lib/geofabrik.ts`:

```bash
osmium tags-filter benelux-latest.osm.pbf \
  nwr/tourism=hotel \
  nwr/tourism=hostel \
  nwr/tourism=motel \
  nwr/tourism=apartment \
  nwr/tourism=guest_house \
  nwr/tourism=chalet \
  nwr/tourism=resort \
  nwr/tourism=alpine_hut \
  nwr/tourism=vacation_rental \
  nwr/tourism=bed_and_breakfast \
  nwr/amenity=hotel \
  -o benelux-accommodation.osm.pbf \
  -f pbf --overwrite
```

### Step 3 — Export to geojsonseq (preferred) or GeoJSON

**geojsonseq** (one Feature per line — best for large files):

```bash
osmium export benelux-accommodation.osm.pbf \
  -o benelux-accommodation.geojsonseq \
  -f geojsonseq --overwrite
```

Regular GeoJSON (smaller extracts):

```bash
osmium export benelux-accommodation.osm.pbf \
  -o benelux-accommodation.geojson \
  -f geojson --overwrite
```

### Step 4 — Upload in Admin

1. Set region bbox in **Region & OSM ingest** (must match the area you want).
2. **Import OSM GeoJSON** → select your `.geojsonseq` or `.geojson` file.
3. WikiTraveler clips to the configured bbox and ingests.

### Optional — clip to bbox before filtering (smaller files)

Bbox format for osmium: `minLon,minLat,maxLon,maxLat`

```bash
# Benelux admin preset: 49.40,2.50,53.55,7.23 → lon/lat for osmium extract
osmium extract -b 2.5,49.4,7.23,53.55 benelux-latest.osm.pbf \
  -o benelux-clipped.osm.pbf --overwrite
```

Then run **tags-filter** and **export** on the clipped file.

### CLI shortcut (existing geojsonseq file)

If you already have a geojsonseq from a prior Geofabrik run:

```bash
pnpm osm:import-pbf --geojson ./path/to/export.geojsonseq
```

---

## Data export / import (not OSM)

Separate from OSM ingest — see Admin panels on `/stats`:

| Tool | Use when |
| --- | --- |
| **Full backup / restore** | Disaster recovery, clone node, migrate server |
| **Export / import audited** | **Region move** — preserve Field Kit / Lens audits (merge by OSM ID) |
| **Export / import users** | Move accounts (no passwords) |

Full backup includes auditor facts but **restore replaces the entire database** — do not use it for a region move.

---

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `OSM_TILE_WARN` | `40` | Warn in preview above this tile count |
| `OSM_TILE_MAX` | `150` | Hard cap on Overpass tiles per job |
| `OSM_TILE_DELAY_MS` | `3000` | Pause between Overpass tile requests |
| `OSM_TILES_PER_CRON` | `1` | Tiles per cron/poll batch (chunked mode) |
| `OSM_INGEST_MODE` | `chunked` on Vercel | `chunked` or `continuous` |
| `OSM_TILE_CACHE_DIR` | `.cache/osm-tiles` | Overpass tile JSON cache (ephemeral on Vercel) |
| `GEOFABRIK_CACHE_DIR` | `.cache/geofabrik` | Downloaded `.pbf` and intermediate files |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full list and cron setup.
