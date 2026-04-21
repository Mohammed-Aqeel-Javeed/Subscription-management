import { promises as fs } from "fs";
import * as path from "path";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

type RouteEntry = {
  routePath: string;
  componentName: string;
  pageKey: string; // e.g. "dashboard" (from @/pages/dashboard)
};

type PageInventory = {
  pageKey: string;
  filePath: string;
  routePaths: string[];
  api: {
    all: string[];
    gets: string[];
    posts: string[];
    puts: string[];
    deletes: string[];
    patches: string[];
  };
};

type ApiEndpointsByFile = {
  filePath: string;
  endpoints: string[];
};

const WORKSPACE_ROOT = path.resolve(__dirname, "..");

function uniqSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(dir: string, filter: (filePath: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [dir];

  while (stack.length) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const e of entries) {
      const p = path.join(current, e.name);
      if (e.isDirectory()) {
        stack.push(p);
      } else if (e.isFile() && filter(p)) {
        out.push(p);
      }
    }
  }

  return out;
}

function normalizeSlash(p: string) {
  return p.replace(/\\/g, "/");
}

function extractApiEndpointsFromSource(source: string): string[] {
  const endpoints: string[] = [];

  // Direct string occurrences: "/api/...", '/api/...', `.../api/...`
  // Allow template strings but stop at whitespace / quote / backtick.
  const re = /\/api\/[A-Za-z0-9_\-./%?=&:+${}~]*[A-Za-z0-9_\-./%?=&:+~]/g;
  for (const m of source.matchAll(re)) {
    endpoints.push(m[0]);
  }

  return uniqSorted(endpoints);
}

function extractApiEndpointConstants(apiSource: string): Record<string, string> {
  // Parses:
  // export const API_ENDPOINTS = { LOGIN: '/api/login', ... } as const;
  const map: Record<string, string> = {};
  const objectRe = /export\s+const\s+API_ENDPOINTS\s*=\s*\{([\s\S]*?)\}\s+as\s+const/;
  const match = apiSource.match(objectRe);
  if (!match) return map;

  const body = match[1];
  const entryRe = /\b([A-Z0-9_]+)\s*:\s*['"]([^'"]+)['"]/g;
  for (const m of body.matchAll(entryRe)) {
    map[m[1]] = m[2];
  }

  return map;
}

function extractApiEndpointsViaConstants(source: string, constants: Record<string, string>): string[] {
  const out: string[] = [];
  const re = /API_ENDPOINTS\.([A-Z0-9_]+)/g;
  for (const m of source.matchAll(re)) {
    const key = m[1];
    const value = constants[key];
    if (value) out.push(value);
  }
  return uniqSorted(out);
}

function extractHttpMethodEndpoints(source: string): {
  gets: string[];
  posts: string[];
  puts: string[];
  deletes: string[];
  patches: string[];
} {
  const sets = {
    gets: new Set<string>(),
    posts: new Set<string>(),
    puts: new Set<string>(),
    deletes: new Set<string>(),
    patches: new Set<string>(),
  };

  // apiRequest("POST", "/api/..."
  const apiRequestRe = /apiRequest\(\s*['"](GET|POST|PUT|DELETE|PATCH)['"]\s*,\s*([`'"])(\/api\/[\s\S]*?)\2/g;
  for (const m of source.matchAll(apiRequestRe)) {
    const method = m[1];
    const endpointRaw = m[3];
    // endpointRaw may contain template expressions; keep it as-is, but trim.
    const endpoint = endpointRaw.split(/\s/)[0].trim();
    if (!endpoint.startsWith("/api/")) continue;

    switch (method) {
      case "GET":
        sets.gets.add(endpoint);
        break;
      case "POST":
        sets.posts.add(endpoint);
        break;
      case "PUT":
        sets.puts.add(endpoint);
        break;
      case "DELETE":
        sets.deletes.add(endpoint);
        break;
      case "PATCH":
        sets.patches.add(endpoint);
        break;
    }
  }

  // fetch("/api/...", { method: "DELETE" }) patterns
  const fetchRe = /fetch\(\s*([`'"])(\/api\/[\s\S]*?)\1\s*,\s*\{[\s\S]*?method\s*:\s*['"](GET|POST|PUT|DELETE|PATCH)['"]/g;
  for (const m of source.matchAll(fetchRe)) {
    const endpoint = m[2].split(/\s/)[0].trim();
    const method = m[3];
    if (!endpoint.startsWith("/api/")) continue;

    switch (method) {
      case "GET":
        sets.gets.add(endpoint);
        break;
      case "POST":
        sets.posts.add(endpoint);
        break;
      case "PUT":
        sets.puts.add(endpoint);
        break;
      case "DELETE":
        sets.deletes.add(endpoint);
        break;
      case "PATCH":
        sets.patches.add(endpoint);
        break;
    }
  }

  return {
    gets: Array.from(sets.gets).sort(),
    posts: Array.from(sets.posts).sort(),
    puts: Array.from(sets.puts).sort(),
    deletes: Array.from(sets.deletes).sort(),
    patches: Array.from(sets.patches).sort(),
  };
}

function extractRoutesFromAppTsx(appSource: string): {
  pageImports: Record<string, string>; // componentName -> pageKey
  routes: RouteEntry[];
} {
  // imports like: import Dashboard from "@/pages/dashboard";
  const pageImports: Record<string, string> = {};
  const importRe = /import\s+([A-Za-z0-9_]+)\s+from\s+["']@\/pages\/([^"']+)["'];/g;
  for (const m of appSource.matchAll(importRe)) {
    pageImports[m[1]] = m[2];
  }

  // routes like: <Route path="/dashboard" element={<Dashboard />} />
  const routes: RouteEntry[] = [];
  const routeRe = /<Route\s+path=["']([^"']+)["']\s+element=\{<([A-Za-z0-9_]+)\s*\/?\s*>\}\s*\/>/g;
  for (const m of appSource.matchAll(routeRe)) {
    const routePath = m[1];
    const componentName = m[2];
    const pageKey = pageImports[componentName] || "";
    routes.push({ routePath, componentName, pageKey });
  }

  return { pageImports, routes };
}

function extractServerEndpointsFromSource(source: string): string[] {
  const endpoints: string[] = [];

  // app.get("/api/..."), app.post(...), router.get(...)
  const re = /\b(app|router)\.(get|post|put|delete|patch)\(\s*['"](\/api\/[^'"]+)['"]/g;
  for (const m of source.matchAll(re)) {
    endpoints.push(`${m[2].toUpperCase()} ${m[3]}`);
  }

  return uniqSorted(endpoints);
}

function extractScheduledJobsFromIndexTs(source: string): { immediate: string[]; dailyMidnightIST: string[] } {
  const immediate: string[] = [];
  const dailyMidnightIST: string[] = [];

  const runNowRe = /runJobNow\(\s*['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(runNowRe)) immediate.push(m[1]);

  const scheduleRe = /scheduleDailyAtMidnightIST\(\s*['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(scheduleRe)) dailyMidnightIST.push(m[1]);

  return {
    immediate: uniqSorted(immediate),
    dailyMidnightIST: uniqSorted(dailyMidnightIST),
  };
}

function extractMongoCollectionsFromSource(source: string): string[] {
  const out: string[] = [];
  const re = /collection\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of source.matchAll(re)) {
    out.push(m[1]);
  }
  return uniqSorted(out);
}

function prettyNameFromKey(key: string) {
  return key
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function paragraph(text: string) {
  return new Paragraph({
    children: [new TextRun({ text })],
  });
}

function bullet(text: string, level = 0) {
  return new Paragraph({
    text,
    bullet: { level },
  });
}

function heading(text: string, level: HeadingLevel) {
  return new Paragraph({
    text,
    heading: level,
  });
}

function monospaceRun(text: string) {
  return new TextRun({ text, font: "Consolas" });
}

function codeParagraph(label: string, code: string) {
  return new Paragraph({
    children: [new TextRun({ text: `${label}: ` }), monospaceRun(code)],
  });
}

function buildSimpleTable(rows: string[][]) {
  const tableRows = rows.map((r) =>
    new TableRow({
      children: r.map(
        (cell) =>
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: cell })],
          })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

async function main() {
  const appTsxPath = path.join(WORKSPACE_ROOT, "client", "src", "App.tsx");
  const apiTsPath = path.join(WORKSPACE_ROOT, "client", "src", "lib", "api.ts");
  const queryClientPath = path.join(WORKSPACE_ROOT, "client", "src", "lib", "queryClient.ts");
  const serverIndexPath = path.join(WORKSPACE_ROOT, "server", "index.ts");
  const serverRoutesPath = path.join(WORKSPACE_ROOT, "server", "routes.ts");
  const analyticsRoutesPath = path.join(WORKSPACE_ROOT, "server", "analytics.routes.ts");
  const stripeRoutesPath = path.join(WORKSPACE_ROOT, "server", "stripe.routes.ts");
  const subtrackerrRoutesPath = path.join(WORKSPACE_ROOT, "server", "subtrackerr.routes.ts");

  for (const p of [appTsxPath, apiTsPath, serverIndexPath, serverRoutesPath]) {
    if (!(await fileExists(p))) {
      throw new Error(`Missing expected file: ${p}`);
    }
  }

  const [appSource, apiSource, queryClientSource, serverIndexSource, serverRoutesSource] = await Promise.all([
    fs.readFile(appTsxPath, "utf8"),
    fs.readFile(apiTsPath, "utf8"),
    (await fileExists(queryClientPath)) ? fs.readFile(queryClientPath, "utf8") : Promise.resolve(""),
    fs.readFile(serverIndexPath, "utf8"),
    fs.readFile(serverRoutesPath, "utf8"),
  ]);

  const apiConstants = extractApiEndpointConstants(apiSource);
  const { routes } = extractRoutesFromAppTsx(appSource);

  // Inventory pages
  const pagesDir = path.join(WORKSPACE_ROOT, "client", "src", "pages");
  const pageFiles = await walkFiles(pagesDir, (p) => p.endsWith(".tsx"));

  // routePaths per pageKey
  const pageKeyToRoutes = new Map<string, string[]>();
  for (const r of routes) {
    if (!r.pageKey) continue;
    const list = pageKeyToRoutes.get(r.pageKey) ?? [];
    list.push(r.routePath);
    pageKeyToRoutes.set(r.pageKey, list);
  }

  const pageInventories: PageInventory[] = [];
  for (const filePath of pageFiles) {
    const pageKey = path.basename(filePath, ".tsx");
    const source = await fs.readFile(filePath, "utf8");

    const endpoints = uniqSorted([
      ...extractApiEndpointsFromSource(source),
      ...extractApiEndpointsViaConstants(source, apiConstants),
    ]);

    const methods = extractHttpMethodEndpoints(source);

    pageInventories.push({
      pageKey,
      filePath: normalizeSlash(path.relative(WORKSPACE_ROOT, filePath)),
      routePaths: uniqSorted(pageKeyToRoutes.get(pageKey) ?? []),
      api: {
        all: endpoints,
        ...methods,
      },
    });
  }

  pageInventories.sort((a, b) => {
    const ap = a.routePaths[0] ?? `~${a.pageKey}`;
    const bp = b.routePaths[0] ?? `~${b.pageKey}`;
    return ap.localeCompare(bp);
  });

  // Inventory server endpoints
  const serverEndpointFiles: ApiEndpointsByFile[] = [];
  const serverFilesToScan: { label: string; p: string }[] = [
    { label: "server/routes.ts", p: serverRoutesPath },
    { label: "server/analytics.routes.ts", p: analyticsRoutesPath },
    { label: "server/stripe.routes.ts", p: stripeRoutesPath },
    { label: "server/subtrackerr.routes.ts", p: subtrackerrRoutesPath },
  ];

  for (const f of serverFilesToScan) {
    if (!(await fileExists(f.p))) continue;
    const src = await fs.readFile(f.p, "utf8");
    serverEndpointFiles.push({
      filePath: f.label,
      endpoints: extractServerEndpointsFromSource(src),
    });
  }

  // Jobs
  const jobs = extractScheduledJobsFromIndexTs(serverIndexSource);

  // Collections
  const serverTsFiles = await walkFiles(path.join(WORKSPACE_ROOT, "server"), (p) => p.endsWith(".ts"));
  const collectionSet = new Set<string>();
  for (const f of serverTsFiles) {
    const src = await fs.readFile(f, "utf8");
    for (const c of extractMongoCollectionsFromSource(src)) collectionSet.add(c);
  }
  const collections = Array.from(collectionSet).sort();

  // Services
  const serviceFiles = serverTsFiles
    .filter((p) => p.endsWith(".service.ts"))
    .map((p) => normalizeSlash(path.relative(WORKSPACE_ROOT, p)))
    .sort();

  const serviceExports: Record<string, string[]> = {};
  for (const rel of serviceFiles) {
    const abs = path.join(WORKSPACE_ROOT, rel);
    const src = await fs.readFile(abs, "utf8");
    const exported: string[] = [];
    const exportRe = /\bexport\s+(?:async\s+)?(class|function)\s+([A-Za-z0-9_]+)/g;
    for (const m of src.matchAll(exportRe)) {
      exported.push(`${m[1]} ${m[2]}`);
    }
    serviceExports[rel] = uniqSorted(exported);
  }

  // Server middleware modules
  const serverMiddlewareDir = path.join(WORKSPACE_ROOT, "server", "middleware");
  const serverMiddlewareFiles = (await fileExists(serverMiddlewareDir))
    ? (await walkFiles(serverMiddlewareDir, (p) => p.endsWith(".ts")))
        .map((p) => normalizeSlash(path.relative(WORKSPACE_ROOT, p)))
        .sort()
    : [];

  // Client modules inventory
  const clientRoot = path.join(WORKSPACE_ROOT, "client", "src");
  const clientModuleDirs = [
    { label: "Contexts", dir: path.join(clientRoot, "context") },
    { label: "Hooks", dir: path.join(clientRoot, "hooks") },
    { label: "Lib", dir: path.join(clientRoot, "lib") },
    { label: "Layout Components", dir: path.join(clientRoot, "components", "layout") },
    { label: "Modals", dir: path.join(clientRoot, "components", "modals") },
    { label: "Charts", dir: path.join(clientRoot, "components", "charts") },
    { label: "UI Components", dir: path.join(clientRoot, "components", "ui") },
  ];

  const clientModules: Record<string, string[]> = {};
  for (const m of clientModuleDirs) {
    if (!(await fileExists(m.dir))) {
      clientModules[m.label] = [];
      continue;
    }
    const files = await walkFiles(m.dir, (p) => p.endsWith(".ts") || p.endsWith(".tsx"));
    clientModules[m.label] = files
      .map((p) => normalizeSlash(path.relative(WORKSPACE_ROOT, p)))
      .sort();
  }

  // Build document
  const generatedAt = new Date().toISOString();
  const title = "SubscriptionTracker — Detailed Project Workflow";

  const docChildren: Paragraph[] = [];

  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 40 })],
      alignment: AlignmentType.CENTER,
    })
  );
  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${generatedAt}`, size: 22 })],
      alignment: AlignmentType.CENTER,
    })
  );
  docChildren.push(new Paragraph({ text: "" }));
  docChildren.push(new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-5",
  }));

  docChildren.push(heading("1. System Overview", HeadingLevel.HEADING_1));
  docChildren.push(paragraph("This document describes the end-to-end workflow of the SubscriptionTracker application, including all client pages, backend modules/routes, scheduled jobs, and the primary data collections used."));

  docChildren.push(heading("1.1 Architecture", HeadingLevel.HEADING_2));
  docChildren.push(bullet("Client: React + Vite, React Router, React Query, Tailwind/Radix UI components."));
  docChildren.push(bullet("Server: Express (TypeScript) + MongoDB storage, JWT + cookie auth, Stripe integration."));
  docChildren.push(bullet("Shared: Zod/Drizzle schema definitions used for typing/validation (and legacy Postgres model types)."));
  docChildren.push(bullet("Security: HTTPS enforcement, security headers, header sanitization; encrypted fields in Mongo documents."));

  docChildren.push(heading("1.2 Client Shell / Navigation", HeadingLevel.HEADING_2));
  docChildren.push(bullet("Main router: client/src/App.tsx"));
  docChildren.push(bullet("Layout: sidebar + header for authenticated routes; public routes hide shell."));
  docChildren.push(bullet("Auth guard: on navigation, client calls /api/me and redirects accordingly."));
  docChildren.push(bullet("Plan lock overlay: TrialExpiredOverlay blocks non-global users when plan is expired/trial-ended."));

  docChildren.push(heading("1.3 API Client & Caching", HeadingLevel.HEADING_2));
  docChildren.push(bullet("apiFetch() adds Authorization (per-tab sessionStorage token) when available and retries with refresh token flow."));
  docChildren.push(bullet("apiRequest() is a JSON helper used by many pages; it includes credentials and optional bearer token."));
  docChildren.push(bullet("React Query is configured with sensible timeouts/retry rules; most GETs are keyed by the /api/... URL."));

  // Key files
  docChildren.push(heading("1.4 Key Source Files", HeadingLevel.HEADING_2));
  docChildren.push(codeParagraph("Client routes", "client/src/App.tsx"));
  docChildren.push(codeParagraph("Client API helper", "client/src/lib/api.ts"));
  docChildren.push(codeParagraph("Client query helper", "client/src/lib/queryClient.ts"));
  docChildren.push(codeParagraph("Server bootstrap", "server/index.ts"));
  docChildren.push(codeParagraph("Server main routes", "server/routes.ts"));

  // Server
  docChildren.push(heading("2. Backend Runtime Workflow", HeadingLevel.HEADING_1));
  docChildren.push(heading("2.1 Startup", HeadingLevel.HEADING_2));
  docChildren.push(bullet("Express server boots in server/index.ts; registers security middleware and JSON parsing."));
  docChildren.push(bullet("Mongo indexes are ensured on startup (best-effort)."));
  docChildren.push(bullet("registerRoutes(app) wires core API endpoints; registerStripeRoutes(app) adds Stripe endpoints/webhook."));
  docChildren.push(heading("2.2 Scheduled Jobs (12:00 AM IST)", HeadingLevel.HEADING_2));

  if (jobs.dailyMidnightIST.length === 0) {
    docChildren.push(paragraph("No scheduled jobs were detected by static scan."));
  } else {
    for (const name of jobs.dailyMidnightIST) {
      docChildren.push(bullet(name));
    }
  }

  docChildren.push(heading("2.3 Jobs Run Immediately on Startup", HeadingLevel.HEADING_2));
  if (jobs.immediate.length === 0) {
    docChildren.push(paragraph("No immediate jobs were detected by static scan."));
  } else {
    for (const name of jobs.immediate) {
      docChildren.push(bullet(name));
    }
  }

  docChildren.push(heading("2.4 Server Modules", HeadingLevel.HEADING_2));
  docChildren.push(paragraph("Core server responsibilities are split between: (a) the large registerRoutes() file, (b) specialized routers, and (c) background services."));
  docChildren.push(bullet(`Route modules detected: ${serverEndpointFiles.map((f) => f.filePath).join(", ")}`));
  docChildren.push(bullet(`Service modules detected (${serviceFiles.length}): ${serviceFiles.join(", ")}`));
  if (serverMiddlewareFiles.length) {
    docChildren.push(bullet(`Middleware modules detected (${serverMiddlewareFiles.length}): ${serverMiddlewareFiles.join(", ")}`));
  }

  docChildren.push(heading("2.6 Server Services (Export Summary)", HeadingLevel.HEADING_2));
  if (!serviceFiles.length) {
    docChildren.push(paragraph("No .service.ts modules detected."));
  } else {
    for (const rel of serviceFiles) {
      docChildren.push(new Paragraph({ children: [new TextRun({ text: rel, bold: true })] }));
      const ex = serviceExports[rel] ?? [];
      if (!ex.length) {
        docChildren.push(bullet("(No exported classes/functions detected by static scan)", 1));
      } else {
        for (const e of ex) docChildren.push(bullet(e, 1));
      }
    }
  }

  docChildren.push(heading("2.5 MongoDB Collections", HeadingLevel.HEADING_2));
  docChildren.push(paragraph("Collections referenced by the server code (static scan):"));
  for (const c of collections) docChildren.push(bullet(c));

  // API endpoints
  docChildren.push(heading("3. API Surface (Endpoint Catalogue)", HeadingLevel.HEADING_1));
  docChildren.push(paragraph("This section lists the endpoints detected in the server route files. It is produced via static regex scan; dynamic routes still appear but may include placeholders."));

  for (const f of serverEndpointFiles) {
    docChildren.push(heading(f.filePath, HeadingLevel.HEADING_2));
    if (!f.endpoints.length) {
      docChildren.push(paragraph("(No endpoints detected in this file by static scan.)"));
      continue;
    }
    for (const ep of f.endpoints) docChildren.push(bullet(ep));
  }

  // Client pages
  docChildren.push(heading("4. Client Pages (All Routes & Workflows)", HeadingLevel.HEADING_1));
  docChildren.push(paragraph("Each page entry includes route(s), the TSX file, and the API endpoints it calls. For complex pages, use the endpoint list to trace workflow into the backend routes/services."));

  // Summary table (route -> page)
  const summaryRows: string[][] = [["Route(s)", "Page", "Key API calls (sample)"]];
  for (const p of pageInventories) {
    const routes = p.routePaths.length ? p.routePaths.join("\n") : "(not directly routed)";
    const keyApis = p.api.all.slice(0, 5).join("\n");
    summaryRows.push([routes, p.pageKey, keyApis || "-"]);
  }

  docChildren.push(heading("4.1 Route-to-Page Map", HeadingLevel.HEADING_2));
  docChildren.push(buildSimpleTable(summaryRows.slice(0, 40)));
  if (summaryRows.length > 40) {
    docChildren.push(paragraph(`Note: table truncated to first 39 pages for readability. Full details are in the per-page sections below.`));
  }

  docChildren.push(heading("4.2 Per-Page Details", HeadingLevel.HEADING_2));

  for (const p of pageInventories) {
    const pageTitle = prettyNameFromKey(p.pageKey);
    docChildren.push(heading(pageTitle, HeadingLevel.HEADING_3));
    docChildren.push(codeParagraph("Source", p.filePath));

    if (p.routePaths.length) {
      docChildren.push(paragraph(`Routes: ${p.routePaths.join(", ")}`));
    } else {
      docChildren.push(paragraph("Routes: (not directly routed from App.tsx; may be navigated indirectly or legacy)"));
    }

    // Heuristic workflow summary
    const workflowBullets: string[] = [];
    if (p.routePaths.some((r) => r.startsWith("/reports"))) {
      workflowBullets.push("Report page: loads data sets and renders charts/tables; supports export in some reports.");
    }
    if (p.api.posts.some((e) => e.includes("/api/subscriptions")) || p.api.puts.some((e) => e.includes("/api/subscriptions"))) {
      workflowBullets.push("Subscription CRUD present: create/update/delete subscriptions and refresh cached lists.");
    }
    if (p.api.all.some((e) => e.includes("/api/compliance"))) {
      workflowBullets.push("Compliance workflow present: filings, deadlines, status transitions, and reminder/notification linkage.");
    }
    if (p.api.all.some((e) => e.includes("/api/licenses"))) {
      workflowBullets.push("Government license workflow present: license records, renewal status log, expiry reminders.");
    }
    if (p.api.all.some((e) => e.includes("/api/stripe"))) {
      workflowBullets.push("Billing workflow present: Stripe checkout session + post-payment completion page.");
    }
    if (p.api.all.some((e) => e.includes("/api/secure-link")) || p.api.all.some((e) => e.includes("/api/deeplink"))) {
      workflowBullets.push("Secure navigation present: encrypted token-based deep links for opening entities without exposing raw IDs." );
    }
    if (workflowBullets.length) {
      docChildren.push(paragraph("Workflow (high level):"));
      for (const w of workflowBullets) docChildren.push(bullet(w));
    }

    // API calls
    if (p.api.all.length) {
      docChildren.push(paragraph("API endpoints referenced by this page (static scan):"));
      for (const ep of p.api.all) docChildren.push(bullet(ep, 0));
    } else {
      docChildren.push(paragraph("API endpoints referenced by this page: (none detected by static scan)"));
    }

    // Methods
    const methodSummary: { label: string; items: string[] }[] = [
      { label: "GET", items: p.api.gets },
      { label: "POST", items: p.api.posts },
      { label: "PUT", items: p.api.puts },
      { label: "DELETE", items: p.api.deletes },
      { label: "PATCH", items: p.api.patches },
    ];

    const anyMethod = methodSummary.some((m) => m.items.length);
    if (anyMethod) {
      docChildren.push(paragraph("HTTP methods detected in page code:"));
      for (const m of methodSummary) {
        if (!m.items.length) continue;
        docChildren.push(new Paragraph({ children: [new TextRun({ text: `${m.label}:`, bold: true })] }));
        for (const i of m.items) docChildren.push(bullet(i, 1));
      }
    }

    docChildren.push(new Paragraph({ text: "" }));
  }

  docChildren.push(heading("5. Client Modules (Contexts, Hooks, Components)", HeadingLevel.HEADING_1));
  docChildren.push(paragraph("This section inventories the main client-side modules that pages compose together (contexts, hooks, layout components, modals, and UI primitives)."));

  for (const [label, files] of Object.entries(clientModules)) {
    docChildren.push(heading(label, HeadingLevel.HEADING_2));
    if (!files.length) {
      docChildren.push(paragraph("(No files detected.)"));
      continue;
    }
    for (const f of files) docChildren.push(bullet(f));
  }

  // Output
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const outPath = path.join(WORKSPACE_ROOT, "Project_Workflow_SubscriptionTracker.docx");
  const buf = await Packer.toBuffer(doc);
  await fs.writeFile(outPath, buf);

  // Also emit a small JSON index alongside for traceability
  const jsonOutPath = path.join(WORKSPACE_ROOT, "Project_Workflow_SubscriptionTracker.index.json");
  await fs.writeFile(
    jsonOutPath,
    JSON.stringify(
      {
        generatedAt,
        pages: pageInventories,
        serverEndpoints: serverEndpointFiles,
        jobs,
        collections,
      },
      null,
      2
    ),
    "utf8"
  );

  // eslint-disable-next-line no-console
  console.log(`DOCX written: ${outPath}`);
  // eslint-disable-next-line no-console
  console.log(`Index written: ${jsonOutPath}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
