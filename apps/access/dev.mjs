import { spawnSync } from "node:child_process";

process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, "--max-old-space-size=4096"]
  .filter(Boolean)
  .join(" ");

const result = spawnSync("pnpm", ["exec", "next", "dev", "-p", "3001"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
