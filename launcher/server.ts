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

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pruneRunLogs } from "./logs";

const HERE = import.meta.dir; // <root>/launcher
const ROOT = join(HERE, "..");

// Nothing below is fixed: the game folder is whatever Settings > Choose folder
// set. Until it is set, the folder this launcher was written for.
const DEFAULT_GAME_DIR = "C:\\Users\\Janeq\\Downloads\\GTA6.Xbox.v1.0.2.1-CYBERLEEK";
const GAME_EXE = "game_scarlett_master.exe";
const SETTINGS_FILE = join(ROOT, "gl79-data", "settings.json");
const PICKER = join(HERE, "pick-folder.ps1");

type Settings = { gameDir: string | null; memoryStack: boolean; record: boolean; prebuild: boolean };

// Read on every use, so a folder chosen in the window applies without a restart,
// and a missing or damaged file just means the defaults (it cannot break a setup
// that already works).
function settings(): Settings {
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, "utf8")) as Partial<Settings>;
    return {
      gameDir: typeof raw.gameDir === "string" && raw.gameDir.trim() !== "" ? raw.gameDir : null,
      memoryStack: raw.memoryStack === true,
      record: raw.record === true,
      prebuild: raw.prebuild !== false,
    };
  } catch {
    return { gameDir: null, memoryStack: false, record: false, prebuild: true };
  }
}

function saveSettings(patch: Partial<Settings>) {
  const next = { ...settings(), ...patch };
  mkdirSync(join(ROOT, "gl79-data"), { recursive: true });
  writeFileSync(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

const gameDirNow = () => settings().gameDir ?? DEFAULT_GAME_DIR;

// The executable Play starts: the title's own name in the folder, or the only .exe
// there (a copy named differently), or nothing at all.
function gameExeIn(dir: string): string | null {
  const known = join(dir, GAME_EXE);
  if (existsSync(known)) return known;
  let exes: string[];
  try {
    exes = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.exe$/i.test(entry.name))
      .map((entry) => join(dir, entry.name));
  } catch {
    return null;
  }
  return exes.length === 1 ? exes[0] : null;
}

const gameExeNow = () => gameExeIn(gameDirNow());

const REPO = join(ROOT, "_gl79");
const SNAPSHOT = join(ROOT, "fork");
const buildExe = (profile: string) => join(REPO, "target", profile, "victory.exe");
// The fork's script knows target\diag and target\release only, so use whichever
// exists. Read every time rather than once at startup, so a build made while the
// launcher is open is usable without restarting it.
const profileNow = () => (existsSync(buildExe("diag")) ? "diag" : existsSync(buildExe("release")) ? "release" : "diag");
const buildExeNow = () => buildExe(profileNow());
const hasSource = () => existsSync(join(REPO, "Cargo.toml"));

// `_gl79` is the runtime's own checkout, so it is not stored in this repository.
// Nobody should have to know that: if it is missing, the snapshot is copied in,
// and so is the config the runtime refuses to start without.
function provisionSource() {
  let copied = false;
  if (!hasSource()) {
    if (!existsSync(join(SNAPSHOT, "Cargo.toml")))
      return { error: `no runtime source: neither ${REPO} nor ${SNAPSHOT} has a Cargo.toml` };
    mkdirSync(REPO, { recursive: true });
    cpSync(SNAPSHOT, REPO, { recursive: true });
    copied = true;
  }
  // The game folder comes from VICTORY_GAME_DIR (childEnv), never from this file.
  const example = join(REPO, "victory.example.toml");
  if (!existsSync(P.config) && existsSync(example)) cpSync(example, P.config);
  return { ok: true, copied };
}

const P = {
  repo: REPO,
  script: join(ROOT, "_gl79", "scripts", "play-rx6600.ps1"),
  config: join(ROOT, "_gl79", "victory.toml"),
  ffx: join(ROOT, "ffx", "Kits", "FidelityFX", "signedbin"),
  agility: join(ROOT, "agility"),
  vendor: join(HERE, "vendor.ps1"),
  data: join(ROOT, "gl79-data"),
  cache: join(ROOT, "gl79-data", "cache-gl79"),
  logs: join(ROOT, "gl79-data", "launcher"),
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

const runArgv = (mode: Mode, exe: string) => [
  "powershell",
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-WindowStyle",
  "Hidden",
  "-File",
  P.script,
  "-Exe",
  exe,
  "-Build",
  profileNow(),
  ...mode.args,
  ...(settings().memoryStack ? ["-MemoryStack"] : []),
  ...(settings().record ? ["-Record"] : []),
];

const prebuildArgv = () => [buildExeNow(), "shaders", "--jobs", "10"];

// The pipelines a recorded run wrote down, made ahead of the next run: what
// stops a frame from dropping the draws whose pipeline is still being made.
const warmArgv = () => [buildExeNow(), "warm", "--used", "--jobs", "8"];

// Byte for byte the command the README gives, so the button and a terminal agree.
const BUILD_ARGV = ["cargo", "build", "--locked", "--profile", "diag", "-p", "victory", "--features", "diagnostics"];

/* ---------- jobs ---------- */

type Job = {
  kind: "run" | "prebuild" | "build" | "warm" | "vendor";
  mode?: Mode;
  log: string;
  startedAt: number;
  endedAt: number | null;
  exit: number | null;
  proc: ReturnType<typeof Bun.spawn>;
  /// The shaders and pipelines this job made are current for this build and
  /// set of switches: write the stamp when it ends cleanly.
  stamp?: boolean;
  /// What to start once it ended cleanly (Play, after its prebuild).
  then?: () => void;
};

let active: Job | null = null; // at most one job, ever
const latest: {
  run: Job | null;
  prebuild: Job | null;
  build: Job | null;
  warm: Job | null;
  vendor: Job | null;
} = {
  run: null,
  prebuild: null,
  build: null,
  warm: null,
  vendor: null,
};
let lastSeen = Date.now();

const quote = (arg: string) => (/\s/.test(arg) ? `"${arg}"` : arg);
const commandOf = (mode: Mode) => runArgv(mode, gameExeNow() ?? join(gameDirNow(), GAME_EXE)).map(quote).join(" ");

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
  env.VICTORY_GAME_DIR = gameDirNow();
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

/* ---------- prebuild stamp ---------- */

// What the shaders and pipelines were made for: this build's victory.exe and
// the VICTORY_* switches in this window. A run whose stamp differs translates
// and warms first, so nothing is compiled during play.
const PREBUILT = join(ROOT, "gl79-data", "prebuilt");

const prebuildStamp = () => {
  const exe = buildExeNow();
  let id = exe;
  try {
    const s = statSync(exe);
    id = `${exe}:${s.size}:${s.mtimeMs}`;
  } catch {
    /* no build: the stamp cannot match, and Play refuses anyway */
  }
  const switches = Object.entries(process.env)
    .filter(([name]) => name.startsWith("VICTORY_"))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join(";");
  return `${Bun.hash(id).toString(16)}-${Bun.hash(switches).toString(16)}`;
};

function prebuiltNow(): string {
  try {
    return readFileSync(PREBUILT, "utf8").trim();
  } catch {
    return "";
  }
}

const markPrebuilt = () => {
  try {
    mkdirSync(join(ROOT, "gl79-data"), { recursive: true });
    writeFileSync(PREBUILT, `${prebuildStamp()}\n`);
  } catch {
    /* a stamp that cannot be written only means the next Play prebuilds again */
  }
};

// The shaders, then the pipelines earlier runs drew: one process, one log.
const prebuildChainArgv = () => {
  const quote = (path: string) => `'${path.replace(/'/g, "''")}'`;
  const exe = quote(buildExeNow());
  return [
    "powershell",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `& ${exe} shaders --jobs 10; if ($LASTEXITCODE -eq 0) { & ${exe} warm --used --jobs 8 }`,
  ];
};

function start(kind: Job["kind"], argv: string[], logTag: string, mode?: Mode, then?: () => void, stampAfter = false) {
  if (active) return { error: active.kind === "run" ? "the game is already running" : "a build is already running" };

  mkdirSync(P.logs, { recursive: true });
  const log = join(P.logs, `${logTag}-${stamp()}.log`);
  // A run log is a session's own: the one before it goes as this one starts.
  if (kind === "run") pruneRunLogs(P.logs, log);
  const sink = Bun.file(log).writer();
  sink.write(`> ${argv.map(quote).join(" ")}\n\n`);

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(argv, { cwd: P.repo, env: childEnv(), stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    sink.end();
    return { error: `could not start it: ${error}` };
  }

  const job: Job = { kind, mode, log, startedAt: Date.now(), endedAt: null, exit: null, proc, stamp: stampAfter, then };

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
      if (code === 0) {
        if (job.stamp) markPrebuilt();
        job.then?.();
      }
    });

  return { ok: true };
}

// Turns "no build" into something actionable: where it looked, and what was there instead.
function buildHint() {
  const debug = buildExe("debug");
  if (existsSync(debug))
    return ` - found ${debug}: a plain "cargo build" makes a debug build, which is not what Play runs. Use Workshop > Build runtime, which builds target\\diag.`;
  if (!hasSource())
    return ` - ${P.repo} has no Cargo.toml: the runtime source is missing. Reopening the launcher copies fork/ in; Workshop > Build runtime does it too.`;
  return ` - nothing built into ${join(P.repo, "target")} yet: use Workshop > Build runtime.`;
}

function startBuild() {
  if (!hasSource()) {
    const made = provisionSource();
    if (made.error) return { error: made.error };
  }
  return start("build", BUILD_ARGV, "build");
}

// Says what is wrong with the game folder, and what fixes it.
function gameHint() {
  const dir = gameDirNow();
  if (!existsSync(dir)) return `missing game: ${dir} is not there. Use Settings > Choose folder to point at your copy.`;
  let exes = 0;
  try {
    exes = readdirSync(dir).filter((name) => /\.exe$/i.test(name)).length;
  } catch {
    return `missing game: ${dir} cannot be read. Use Settings > Choose folder to pick it again.`;
  }
  if (exes > 1)
    return `missing game: ${dir} holds ${exes} executables, none of them ${GAME_EXE}. Use Settings > Choose folder to pick the folder that has it.`;
  return `missing game: ${dir} has no ${GAME_EXE}. Use Settings > Choose folder to point at your copy.`;
}

function startRun(modeId: string) {
  const mode = MODES.find((m) => m.id === modeId);
  if (!mode) return { error: "unknown mode" };
  if (!hasSource()) provisionSource();
  if (!existsSync(P.script)) return { error: `missing script: ${P.script}` };
  if (!existsSync(buildExeNow())) return { error: `missing build: ${buildExeNow()}${buildHint()}` };
  const exe = gameExeNow();
  if (!exe) return { error: gameHint() };
  if (mode.args.includes("-FidelityFxDir") && !existsSync(join(P.ffx, "amd_fidelityfx_upscaler_dx12.dll")))
    return { error: `missing FidelityFX: ${join(P.ffx, "amd_fidelityfx_upscaler_dx12.dll")}` };
  // Shaders and pipelines first when this build or these switches have not had
  // them made yet: the run then never compiles while you look at it.
  if (settings().prebuild && prebuiltNow() !== prebuildStamp()) {
    const made = start("prebuild", prebuildChainArgv(), "prebuild", undefined, () => startRun(modeId), true);
    return "error" in made ? made : { ok: true, preparing: true };
  }
  return start("run", runArgv(mode, exe), `run-${mode.id}`, mode);
}

// The two SDKs the fork's script and this project expect from their own
// publishers: Microsoft's DirectX 12 Agility SDK and AMD's FSR SDK. Each is
// fetched only when it is not here, with its license beside it.
const sdksMissing = () => {
  const missing: string[] = [];
  if (!existsSync(join(P.agility, "D3D12Core.dll"))) missing.push("DirectX 12 Agility SDK");
  if (!existsSync(join(P.ffx, "amd_fidelityfx_upscaler_dx12.dll"))) missing.push("AMD FSR SDK");
  return missing;
};

function startVendor() {
  if (!existsSync(P.vendor)) return { error: `missing script: ${P.vendor}` };
  return start(
    "vendor",
    ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", P.vendor],
    "vendor",
  );
}

function startPrebuild() {
  if (!existsSync(buildExeNow())) return { error: `missing build: ${buildExeNow()}${buildHint()}` };
  return start("prebuild", prebuildArgv(), "prebuild");
}

function startWarm() {
  if (!existsSync(buildExeNow())) return { error: `missing build: ${buildExeNow()}${buildHint()}` };
  return start("warm", warmArgv(), "warm");
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
  const build = latest.build;
  const warm = latest.warm;
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
      startedAt: prebuild?.startedAt ?? null,
      log: (await tailLines(prebuild, 16_000)).slice(-200),
    },
    build: {
      running: build?.exit === null,
      exit: build?.exit ?? null,
      logPath: build?.log ?? null,
      startedAt: build?.startedAt ?? null,
      log: (await tailLines(build, 16_000)).slice(-200),
    },
    warm: {
      running: warm?.exit === null,
      exit: warm?.exit ?? null,
      logPath: warm?.log ?? null,
      startedAt: warm?.startedAt ?? null,
      log: (await tailLines(warm, 16_000)).slice(-200),
    },
    source: hasSource(),
    memoryStack: settings().memoryStack,
    record: settings().record,
    prebuildBeforePlay: settings().prebuild,
    prebuilt: prebuiltNow() === prebuildStamp(),
    sdksMissing: sdksMissing(),
    paths: {
      game: gameExeNow() ?? join(gameDirNow(), GAME_EXE),
      gameDir: gameDirNow(),
      build: buildExeNow(),
      profile: profileNow(),
      script: P.script,
      ffx: P.ffx,
      agility: P.agility,
      config: P.config,
      logs: P.logs,
    },
    checks: {
      game: gameExeNow() !== null,
      build: existsSync(buildExeNow()),
      script: existsSync(P.script),
      ffx: existsSync(join(P.ffx, "amd_fidelityfx_upscaler_dx12.dll")),
      agility: existsSync(join(P.agility, "D3D12Core.dll")),
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

const openable = (): Record<string, string> => ({ logs: P.logs, cache: P.cache, game: gameDirNow(), data: P.data, repo: P.repo });

function openFolder(target: string) {
  const dir = openable()[target];
  if (!dir || !existsSync(dir)) return { error: `missing: ${target}` };
  Bun.spawn(["explorer.exe", dir], { stdio: ["ignore", "ignore", "ignore"] });
  return { ok: true };
}

function isLocal(req: Request, url: URL) {
  const origin = req.headers.get("origin");
  return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && (!origin || /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin));
}

// The window's "Choose folder" button: a native folder dialog, and the folder it
// returns saved as the game folder.
async function pickGameDir() {
  if (!existsSync(PICKER)) return { error: `missing picker: ${PICKER}` };

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(["powershell", "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", PICKER], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "ignore",
    });
  } catch (error) {
    return { error: `could not open the folder dialog: ${error}` };
  }

  const picked = (await new Response(proc.stdout as ReadableStream<Uint8Array>).text()).trim().replace(/^"|"$/g, "");
  await proc.exited;

  if (!picked) return { ok: false, cancelled: true };
  if (!existsSync(picked)) return { error: `that folder is not there: ${picked}` };
  const exe = gameExeIn(picked);
  if (!exe)
    return { error: `${picked} has no ${GAME_EXE} and no single executable to use instead. Pick the folder that holds the game.` };

  saveSettings({ gameDir: picked });
  return { ok: true, gameDir: picked, game: exe };
}

function setMemoryStack(on: unknown) {
  if (typeof on !== "boolean") return { error: "expected true or false" };
  saveSettings({ memoryStack: on });
  return { ok: true, memoryStack: on };
}

function setRecord(on: unknown) {
  if (typeof on !== "boolean") return { error: "expected true or false" };
  saveSettings({ record: on });
  return { ok: true, record: on };
}

function setPrebuild(on: unknown) {
  if (typeof on !== "boolean") return { error: "expected true or false" };
  saveSettings({ prebuild: on });
  return { ok: true, prebuild: on };
}

async function route(req: Request, url: URL) {
  if (url.pathname === "/api/state") return json(await snapshot());
  if (url.pathname === "/api/game-dir") return json(await pickGameDir());
  if (url.pathname === "/api/memory-stack") return json(setMemoryStack((await body(req)).on));
  if (url.pathname === "/api/record") return json(setRecord((await body(req)).on));
  if (url.pathname === "/api/prebuild-before-play") return json(setPrebuild((await body(req)).on));
  if (url.pathname === "/api/play") return json(startRun(String((await body(req)).mode ?? "")));
  if (url.pathname === "/api/stop") return json(stop());
  if (url.pathname === "/api/prebuild") return json(startPrebuild());
  if (url.pathname === "/api/vendor") return json(startVendor());
  if (url.pathname === "/api/warm") return json(startWarm());
  if (url.pathname === "/api/build") return json(startBuild());
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
  const made = provisionSource();
  if (made.copied) console.log(`copied the runtime source into ${REPO}`);
  else if (made.error) console.error(made.error);

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

  // The two SDKs from their own publishers, once, when they are not here yet:
  // a job in the Workshop console like any other, so the log says what it got.
  const missing = sdksMissing();
  if (missing.length) {
    console.log(`fetching ${missing.join(" and ")}`);
    startVendor();
  }

  // The window polls; when it is gone, nothing keeps this server alive.
  setInterval(() => {
    if (!active && Date.now() - lastSeen > 120_000) process.exit(0);
  }, 20_000);
}

await boot();
