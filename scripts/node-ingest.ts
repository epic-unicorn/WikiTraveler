/**
 * Offline OSM ingest CLI router.
 *
 * Usage:
 *   pnpm node:ingest overpass --preset netherlands
 *   pnpm node:ingest overpass --bbox "51.39,5.42,51.49,5.52"
 *   pnpm node:ingest pbf --region netherlands
 *   pnpm node:ingest geojson --file ./export.geojsonseq --bbox "..."
 */

import { spawnSync } from "child_process";
import { join } from "path";

const ROOT = join(__dirname, "..");
const mode = process.argv[2];
const rest = process.argv.slice(3);

const scripts: Record<string, string> = {
  overpass: "node-ingest-overpass.ts",
  pbf: "node-ingest-pbf.ts",
  geojson: "node-ingest-pbf.ts",
};

if (!mode || !scripts[mode]) {
  console.error("Usage: pnpm node:ingest <overpass|pbf|geojson> [options]");
  process.exit(1);
}

const script = join(__dirname, scripts[mode]!);
const args = ["exec", "tsx", "--tsconfig", "apps/node/tsconfig.json", script, ...rest];
if (mode === "geojson" && !rest.includes("--geojson")) {
  const fileIdx = rest.indexOf("--file");
  if (fileIdx >= 0 && rest[fileIdx + 1]) {
    args.push("--geojson", rest[fileIdx + 1]!);
  }
}

const result = spawnSync("pnpm", args, { cwd: ROOT, stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
