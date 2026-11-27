// Retail Game launcher for the gleaf-6 VIctory fork, tuned for a Radeon RX 6600 8 GB.
//
// A loopback-only server: it serves the launcher UI and starts the fork's own
// measured 8 GB script, `_gl79/scripts/play-rx6600.ps1`. It configures nothing
// itself; it runs a mode, streams the output to a log, and reports the numbers
// the host prints.
//
//   optimized  Series S, 1280x720, PC FidelityFX (FSR 4.1.2) + frame generation
//   normal     Series X, 1920x1080, no upscaler, no generated frames
//
// Every process is a child of this server, so "Stop" ends the whole tree and
// the window closing (no requests for two minutes) ends the server too.

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dir; // <root>/launcher
const ROOT = join(HERE, "..");
const GAME_DIR = "C:\\Users\\Janeq\\Downloads\\GTA6.Xbox.v1.0.2.1-CYBERLEEK";

const P = {
  repo: join(ROOT, "_gl79"),
  script: join(ROOT, "_gl79", "scripts", "play-rx6600.ps1"),
  build: join(ROOT, "_gl79", "target", "diag", "victory.exe"),
  config: join(ROOT, "_gl79", "victory.toml"),
  ffx: join(ROOT, "ffx", "Kits", "FidelityFX", "signedbin"),
  data: join(ROOT, "gl79-data"),
  cache: join(ROOT, "gl79-data", "cache-gl79"),
  logs: join(ROOT, "gl79-data", "launcher"),
  game: join(GAME_DIR, "game_scarlett_master.exe"),
  gameDir: GAME_DIR,
};

type Mode = { id: "optimized" | "normal"; name: string; badge: string; detail: string; args: string[] };

const MODES: Mode[] = [
  {
    id: "optimized",
    name: "Optimized",
    badge: "Recommended",
    detail: "Series S · 1280×720 · FSR 4.1.2 + frame generation",
    args: ["-FidelityFxDir", P.ffx, "-SeriesS", "-Resolution", "1280x720", "-Stats"],
  },
  {
    id: "normal",
    name: "Normal",
    badge: "Unoptimized",
    detail: "Series X · 1920×1080 · no upscaler, no generated frames",
    args: ["-SeriesX", "-Resolution", "1920x1080", "-Stats"],
  },
];

const runArgv = (mode: Mode) =>
  ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", P.script, "-Exe", P.game, ...mode.args];

const PREBUILD_ARGV = [P.build, "shaders", "--jobs", "10"];

/* ---------- jobs ---------- */

type Job = {
  kind: "run" | "prebuild";
  mode?: Mode;
  log: string;
  startedAt: number;
  endedAt: number | null;
  exit: number | null;
  proc: ReturnType<typeof Bun.spawn>;
};

let active: Job | null = null; // at most one job, ever
const latest: { run: Job | null; prebuild: Job | null } = { run: null, prebuild: null };
let lastSeen = Date.now();

const quote = (arg: string) => (/\s/.test(arg) ? `"${arg}"` : arg);
const commandOf = (mode: Mode) => runArgv(mode).map(quote).join(" ");

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function childEnv() {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  // play-rx6600.ps1 drops every VICTORY_* it does not keep, so only these stay.
  env.VICTORY_CONFIG = P.config;
  env.VICTORY_CACHE_DIR = P.cache;
  env.VICTORY_DATA_DIR = P.data;
  return env;
}

async function pump(stream: ReadableStream<Uint8Array> | undefined, sink: ReturnType<ReturnType<typeof Bun.file>["writer"]>) {
  if (!stream) return;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
    if (done) return;
    if (value?.byteLength) {
      sink.write(value);
      sink.flush();
    }
  }
}

function start(kind: Job["kind"], argv: string[], logTag: string, mode?: Mode) {
  if (active) return { error: active.kind === "run" ? "the game is already running" : "a build is already running" };

  mkdirSync(P.logs, { recursive: true });
  const log = join(P.logs, `${logTag}-${stamp()}.log`);
  const sink = Bun.file(log).writer();
  sink.write(`> ${argv.map(quote).join(" ")}\n\n`);

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(argv, { cwd: P.repo, env: childEnv(), stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    sink.end();
    return { error: `could not start it: ${error}` };
  }

  const job: Job = { kind, mode, log, startedAt: Date.now(), endedAt: null, exit: null, proc };

  active = job;
  latest[kind] = job;

  void Promise.all([pump(job.proc.stdout as ReadableStream<Uint8Array>, sink), pump(job.proc.stderr as ReadableStream<Uint8Array>, sink)])
    .then(() => job.proc.exited)
    .then((code) => {
      try {
        sink.write(`\n[exit ${code}]\n`);
        sink.end();
      } catch {
        /* the sink is already closed */
      }
      job.exit = code;
      job.endedAt = Date.now();
      if (active === job) active = null;
    });

  return { ok: true };
}

function startRun(modeId: string) {
  const mode = MODES.find((m) => m.id === modeId);
  if (!mode) return { error: "unknown mode" };
  if (!existsSync(P.script)) return { error: `missing script: ${P.script}` };
  if (!existsSync(P.build)) return { error: `missing build: ${P.build}` };
  if (!existsSync(P.game)) return { error: `missing dump: ${P.game}` };
  if (mode.args.includes("-FidelityFxDir") && !existsSync(join(P.ffx, "amd_fidelityfx_upscaler_dx12.dll")))
    return { error: `missing FidelityFX: ${join(P.ffx, "amd_fidelityfx_upscaler_dx12.dll")}` };
  return start("run", runArgv(mode), `run-${mode.id}`, mode);
}

function startPrebuild() {
  if (!existsSync(P.build)) return { error: `missing build: ${P.build}` };
  return start("prebuild", PREBUILD_ARGV, "prebuild");
}

function stop() {
  if (!active) return { error: "nothing is running" };
  Bun.spawn(["taskkill", "/PID", String(active.proc.pid), "/T", "/F"], { stdio: ["ignore", "ignore", "ignore"] });
  return { ok: true };
}

/* ---------- logs ---------- */

async function tail(file: string, bytes = 32_000) {
  try {
    const size = statSync(file).size;
    return await Bun.file(file).slice(Math.max(0, size - bytes)).text();
  } catch {
    return "";
  }
}

async function tailLines(job: Job | null, bytes?: number) {
  if (!job) return [];
  return (await tail(job.log, bytes)).split(/\r?\n/);
}

function metrics(text: string) {
  const out: { fps: number | null; ms: number | null; card: string | null } = { fps: null, ms: null, card: null };
  const frames = [...text.matchAll(/(\d+(?:\.\d+)?) fps,\s*(\d+(?:\.\d+)?) ms\/frame/g)].pop();
  if (frames) {
    out.fps = Number(frames[1]);
    out.ms = Number(frames[2]);
  }
  const card = [...text.matchAll(/card[^\d\n]{0,16}(\d+)\s*\/\s*(\d+)\s*MB/gi)].pop();
  if (card) out.card = `${card[1]} / ${card[2]} MB`;
  return out;
}

/* ---------- cache ---------- */

let cacheTotals: { at: number; files: number; bytes: number } | null = null;

function cacheStats() {
  if (cacheTotals && Date.now() - cacheTotals.at < 30_000) return cacheTotals;
  let files = 0;
  let bytes = 0;
  const pending = [P.cache];
  while (pending.length) {
    const dir = pending.pop()!;
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
        continue;
      }
      files += 1;
      try {
        bytes += statSync(path).size;
      } catch {
        /* vanished while walking */
      }
    }
  }
  return (cacheTotals = { at: Date.now(), files, bytes });
}

function human(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/* ---------- state ---------- */

async function snapshot() {
  const run = latest.run;
  const prebuild = latest.prebuild;
  const running = run?.exit === null ? run : null;
  const cache = cacheStats();
  const runLog = await tail(run?.log ?? "");

  return {
    app: "victory-launcher",
    modes: MODES.map((m) => ({ id: m.id, name: m.name, badge: m.badge, detail: m.detail, command: commandOf(m) })),
    running: !!running,
    runningMode: running?.mode?.id ?? null,
    startedAt: running?.startedAt ?? null,
    last: run && run.exit !== null ? { mode: run.mode?.id ?? null, exit: run.exit, at: run.endedAt } : null,
    busy: active?.kind ?? null,
    logPath: run?.log ?? null,
    log: runLog ? runLog.split(/\r?\n/).slice(-400) : [],
    metrics: metrics(runLog),
    cache: { files: cache.files, bytes: cache.bytes, human: human(cache.bytes), dir: P.cache },
    prebuild: {
      running: prebuild?.exit === null,
      exit: prebuild?.exit ?? null,
      logPath: prebuild?.log ?? null,
      log: (await tailLines(prebuild, 16_000)).slice(-200),
    },
    paths: {
      game: P.game,
      build: P.build,
      script: P.script,
      ffx: P.ffx,
      config: P.config,
      logs: P.logs,
    },
    checks: {
      game: existsSync(P.game),
      build: existsSync(P.build),
      script: existsSync(P.script),
      ffx: existsSync(join(P.ffx, "amd_fidelityfx_upscaler_dx12.dll")),
      config: existsSync(P.config),
    },
  };
}

/* ---------- http ---------- */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function body(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function staticFile(pathname: string) {
  const rel = decodeURIComponent(pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
  if (rel.includes("..")) return new Response("bad path", { status: 400 });
  const file = join(HERE, "public", rel);
  if (!existsSync(file)) return new Response("not found", { status: 404 });
  const type = MIME[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream";
  return new Response(Bun.file(file), { headers: { "content-type": type } });
}

const OPENABLE: Record<string, string> = { logs: P.logs, cache: P.cache, game: P.gameDir, data: P.data, repo: P.repo };

function openFolder(target: string) {
  const dir = OPENABLE[target];
  if (!dir || !existsSync(dir)) return { error: `missing: ${target}` };
  Bun.spawn(["explorer.exe", dir], { stdio: ["ignore", "ignore", "ignore"] });
  return { ok: true };
}

function isLocal(req: Request, url: URL) {
  const origin = req.headers.get("origin");
  return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && (!origin || /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin));
}

async function route(req: Request, url: URL) {
  if (url.pathname === "/api/state") return json(await snapshot());
  if (url.pathname === "/api/play") return json(startRun(String((await body(req)).mode ?? "")));
  if (url.pathname === "/api/stop") return json(stop());
  if (url.pathname === "/api/prebuild") return json(startPrebuild());
  if (url.pathname === "/api/open") return json(openFolder(String((await body(req)).target ?? "")));
  if (url.pathname === "/api/quit") {
    setTimeout(() => process.exit(0), 120);
    return json({ ok: true });
  }
  return staticFile(url.pathname);
}

function serveOn(port: number) {
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    idleTimeout: 60,
    async fetch(req) {
      lastSeen = Date.now();
      const url = new URL(req.url);
      const isApi = url.pathname.startsWith("/api/");
      if (isApi && (req.method !== "GET" && req.method !== "POST")) return json({ error: "method" }, 405);
      if (isApi && !isLocal(req, url)) return json({ error: "local only" }, 403);
      return route(req, url);
    },
  });
}

/* ---------- window ---------- */

const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function openWindow(url: string) {
  const browser = BROWSERS.find((path) => existsSync(path));
  if (!browser) {
    Bun.spawn(["cmd.exe", "/c", "start", "", url], { stdio: ["ignore", "ignore", "ignore"] });
    return;
  }
  // --app: no tabs, no address bar; its own profile so it never joins a session.
  Bun.spawn(
    [browser, `--app=${url}`, "--window-size=1280,880", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(HERE, ".window")}`],
    { stdio: ["ignore", "ignore", "ignore"] },
  );
}

async function boot() {
  let server: ReturnType<typeof Bun.serve> | null = null;
  let port = 7788;

  while (!server && port < 7800) {
    try {
      server = serveOn(port);
    } catch {
      // Taken. If it is this launcher, show that one instead of a second.
      const ours = await fetch(`http://127.0.0.1:${port}/api/state`, { signal: AbortSignal.timeout(1200) })
        .then((r) => r.json() as Promise<{ app?: string }>)
        .catch(() => null);
      if (ours?.app === "victory-launcher") {
        openWindow(`http://127.0.0.1:${port}/`);
        process.exit(0);
      }
      port += 1;
    }
  }
  if (!server) {
    console.error("no free port for the launcher");
    process.exit(1);
  }

  const url = `http://127.0.0.1:${port}/`;
  console.log(`launcher on ${url}`);
  if (process.env.LAUNCHER_NO_WINDOW !== "1") openWindow(url);

  // The window polls; when it is gone, nothing keeps this server alive.
  setInterval(() => {
    if (!active && Date.now() - lastSeen > 120_000) process.exit(0);
  }, 20_000);
}

await boot();
