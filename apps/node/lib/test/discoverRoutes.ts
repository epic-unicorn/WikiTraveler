import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RouteCase {
  /** Import alias path, e.g. @/app/api/health/route */
  importPath: string;
  /** URL path under /api, e.g. health or properties/[id] */
  apiPath: string;
  method: HttpMethod;
  params: Record<string, string>;
}

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const PARAM_SAMPLES: Record<string, string> = {
  id: "00000000-0000-4000-8000-000000000001",
  username: "testuser",
  fieldName: "entrance",
};

function paramsFromSegments(segments: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const segment of segments) {
    const match = /^\[(.+)\]$/.exec(segment);
    if (match) {
      const key = match[1];
      params[key] = PARAM_SAMPLES[key] ?? "test-value";
    }
  }
  return params;
}

function methodsFromSource(source: string): HttpMethod[] {
  return HTTP_METHODS.filter((method) =>
    new RegExp(`export\\s+async\\s+function\\s+${method}\\b`).test(source)
  );
}

function discoverRoutes(apiRoot: string): Omit<RouteCase, "method">[] {
  const routes: Omit<RouteCase, "method">[] = [];

  function walk(dir: string, segments: string[] = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full, [...segments, name]);
        continue;
      }
      if (name !== "route.ts") continue;

      const rel = relative(apiRoot, dir).split(/[/\\]/).filter(Boolean);
      const apiPath = rel.join("/");
      routes.push({
        importPath: `@/app/api/${apiPath}/route`,
        apiPath,
        params: paramsFromSegments(rel),
      });
    }
  }

  walk(apiRoot);
  return routes.sort((a, b) => a.importPath.localeCompare(b.importPath));
}

/** Scan route.ts files without importing them (keeps mocks effective at first invoke). */
export function discoverRouteCases(apiRoot: string): RouteCase[] {
  const routes = discoverRoutes(apiRoot);
  const cases: RouteCase[] = [];

  for (const route of routes) {
    const filePath = join(apiRoot, route.apiPath, "route.ts");
    const source = readFileSync(filePath, "utf8");
    for (const method of methodsFromSource(source)) {
      cases.push({ ...route, method });
    }
  }

  return cases;
}

export function routeUrl(apiPath: string, params: Record<string, string>): string {
  let path = apiPath;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`[${key}]`, encodeURIComponent(value));
  }
  return `http://localhost/api/${path}`;
}
