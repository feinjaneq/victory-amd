// Launcher UI. It talks only to the local Bun server next to it.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const el = {
  play: $("#play"),
  playText: $("#play-text"),
  more: $("#play-more"),
  menu: $("#mode-menu"),
  profile: $("#profile-line"),
  runline: $("#runline"),
  fps: $("#stat-fps"),
  ms: $("#stat-ms"),
  card: $("#stat-card"),
  cache: $("#stat-cache"),
  console: $("#console"),
  logName: $("#log-name"),
  logTail: $("#log-tail"),
  net: $("#net"),
  pill: $(".tab-pill"),
  wsFiles: $("#ws-files"),
  wsSize: $("#ws-size"),
  wsDir: $("#ws-dir"),
  wsBuild: $("#ws-build"),
  prebuild: $("#prebuild"),
  prebuildNote: $("#prebuild-note"),
  warm: $("#warm"),
  warmNote: $("#warm-note"),
  build: $("#build-runtime"),
  buildNote: $("#build-note"),
  wsConsole: $("#ws-console"),
  wsLog: $("#ws-log"),
  wsLogName: $("#ws-log-name"),
  cmdList: $("#cmd-list"),
  paths: $("#paths"),
  gameDir: $("#game-dir"),
  gameExe: $("#game-exe"),
  gameNote: $("#game-note"),
  pickGame: $("#pick-game-dir"),
  memoryNote: $("#memory-note"),
  memoryToggle: $("#memory-toggle"),
  recordNote: $("#record-note"),
  recordToggle: $("#record-toggle"),
  prebuildBeforeNote: $("#prebuild-before-note"),
  prebuildToggle: $("#prebuild-toggle"),
};

let mode = localStorage.getItem("run-mode") === "normal" ? "normal" : "optimized";
let data = null;
let pollTimer = 0;
let tickTimer = 0;
let leaveTimer = 0;
let leaving = null;
let drawn = false;

async function api(path, body) {
  try {
    const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
    return await res.json();
  } catch {
    return { error: "the launcher server is not answering" };
  }
}

/* ---------- tabs ---------- */

function movePill(tab) {
  if (!tab) return;
  // The label starts after the tab's 12px side padding; the rule spans the label.
  el.pill.style.transform = `translateX(${tab.offsetLeft + 12}px)`;
  el.pill.style.width = `${tab.offsetWidth - 24}px`;
}

function go(name) {
  const tab = $(`.tab[data-tab="${name}"]`);
  const next = $(`#view-${name}`);
  if (!tab || !next) return;

  $$(".tab").forEach((t) => {
    const on = t === tab;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", String(on));
  });
  $$(".row[data-tab]").forEach((r) => r.classList.toggle("is-active", r.dataset.tab === name));
  $$(".view").forEach((view) => {
    const on = view === next;
    view.inert = !on;
    view.setAttribute("aria-hidden", String(!on));
  });
  movePill(tab);

  const current = $(".view.is-active");
  if (current === next) return;

  // The old panel clears the stage first; the new one fades in behind it.
  clearTimeout(leaveTimer);
  if (leaving) leaving.classList.remove("is-leaving");
  if (current) {
    current.classList.remove("is-active");
    current.classList.add("is-leaving");
    leaving = current;
  }
  next.classList.remove("is-leaving");
  setTimeout(() => next.classList.add("is-active"), 90);
  leaveTimer = setTimeout(() => {
    leaving?.classList.remove("is-leaving");
    leaving = null;
  }, 460);
}

$$(".tab").forEach((tab) => tab.addEventListener("click", () => go(tab.dataset.tab)));
$$(".row[data-tab]").forEach((row) => row.addEventListener("click", () => go(row.dataset.tab)));

$(".tabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const tabs = $$(".tab");
  const from = tabs.findIndex((t) => t.classList.contains("is-active"));
  const tab = tabs[(from + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
  tab.focus();
  go(tab.dataset.tab);
});

/* ---------- mode menu ---------- */

function setMenu(open) {
  if (open) {
    // Fixed, positioned from the button: the hero clips its own content.
    const rect = $(".launch").getBoundingClientRect();
    el.menu.style.left = `${Math.round(rect.left)}px`;
    el.menu.style.top = `${Math.round(rect.bottom + 10)}px`;
  }
  el.menu.classList.toggle("is-open", open);
  el.more.classList.toggle("is-open", open);
  el.more.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
}

const menuOpen = () => el.menu.classList.contains("is-open");

el.more.addEventListener("click", (e) => {
  e.stopPropagation();
  setMenu(!menuOpen());
});

document.addEventListener("click", (e) => {
  if (menuOpen() && !el.menu.contains(e.target) && !el.more.contains(e.target)) setMenu(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenu(false);
});

window.addEventListener("resize", () => {
  setMenu(false);
  movePill($(".tab.is-active"));
});

$("#view-games").addEventListener("scroll", () => {
  if (menuOpen()) setMenu(false);
});

$$(".menu-item").forEach((item) =>
  item.addEventListener("click", () => {
    mode = item.dataset.mode;
    localStorage.setItem("run-mode", mode);
    setMenu(false);
    renderMode();
  }),
);

function renderMode() {
  $$(".menu-item").forEach((item) => {
    const on = item.dataset.mode === mode;
    item.classList.toggle("is-picked", on);
    item.setAttribute("aria-checked", String(on));
  });
  const picked = data?.modes.find((m) => m.id === mode);
  if (picked) el.profile.textContent = picked.detail;
}

/* ---------- console drawers ---------- */

for (const [box, label] of [
  [el.console, $(".console-more", el.console)],
  [el.wsConsole, $(".console-more", el.wsConsole)],
]) {
  $(".console-head", box).addEventListener("click", () => {
    const open = box.classList.toggle("is-open");
    label.textContent = open ? "collapse" : "expand";
  });
}

/* ---------- formatting ---------- */

const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function setRunline(text, cls = "") {
  el.runline.className = `runline ${cls}`.trim();
  el.runline.innerHTML = `<i></i>${text}`;
}

function showRunline() {
  if (!data) return;
  if (data.running) {
    setRunline(`Running · ${mmss(Date.now() - data.startedAt)} · ${data.runningMode}`, "is-running");
  } else if (data.busy === "prebuild") {
    setRunline("Preparing shaders and pipelines before the first frame…", "is-running");
  } else if (!data.checks.game) {
    setRunline("Game folder not set — Settings → Choose folder…", "is-error");
  } else if (data.last) {
    const ok = data.last.exit === 0;
    setRunline(`Last run exited ${ok ? "cleanly" : `with code ${data.last.exit}`} · ${data.last.mode}`, ok ? "" : "is-error");
  } else {
    setRunline("Ready — nothing has been started from here yet");
  }
}

/* ---------- render ---------- */

function render() {
  const running = data.running;
  const ready = data.checks.game && data.checks.build && data.checks.script;

  el.play.classList.toggle("is-running", running);
  el.play.disabled = !running && !ready;
  el.playText.textContent = running ? "Stop" : "Play";

  el.net.classList.toggle("is-off", !ready);
  $("span", el.net).textContent = !ready ? "no build" : running ? "running" : "ready";

  const { fps, ms, card } = data.metrics;
  el.fps.textContent = fps === null ? "—" : fps.toFixed(1);
  el.ms.textContent = ms === null ? "—" : `${ms.toFixed(0)} ms`;
  el.card.textContent = card ?? "—";
  el.cache.textContent = data.cache.human;

  el.wsFiles.textContent = data.cache.files.toLocaleString("en-US");
  el.wsSize.textContent = `${data.cache.human} on disk`;
  el.wsDir.textContent = data.cache.dir;
  el.wsBuild.textContent = data.paths.build;

  el.gameDir.textContent = data.paths.gameDir;
  el.gameExe.textContent = data.checks.game ? data.paths.game : `${data.paths.game} — not found`;
  el.memoryToggle.textContent = data.memoryStack ? "Turn off" : "Turn on";
  el.memoryNote.textContent = data.memoryStack
    ? "On: Play passes -MemoryStack, and the runtime turns its 15 memory switches on for that run."
    : "Off: Play runs the runtime as it shipped, every memory switch at its default.";

  el.prebuildToggle.textContent = data.prebuildBeforePlay ? "Turn off" : "Turn on";
  el.prebuildBeforeNote.textContent = data.prebuildBeforePlay
    ? data.prebuilt
      ? "On: the shaders and the recorded pipelines are current for this build; Play starts at once."
      : "On: Play first translates the shaders and makes the recorded pipelines, then starts the game."
    : "Off: Play starts the game at once, and anything not cached is compiled during play.";

  el.recordToggle.textContent = data.record ? "Turn off" : "Turn on";
  el.recordNote.textContent = data.record
    ? "On: Play passes -Record, so the run writes down every pipeline it makes. Warm pipelines then makes them ahead of the next run."
    : "Off: Play writes no pipeline book down, so Warm pipelines has nothing new to make.";

  showRunline();

  el.logName.textContent = data.logPath?.split(/[\\/]/).pop() ?? "run log";
  const lines = data.log.filter((line) => line.trim() !== "").slice(-40);
  el.logTail.textContent = lines.join("\n") || "No run yet — pick a mode and press Play.";
  if (el.console.classList.contains("is-open")) el.logTail.scrollTop = el.logTail.scrollHeight;

  const pre = data.prebuild;
  const bld = data.build;
  const war = data.warm;
  const busy = data.busy !== null;

  el.build.disabled = busy;
  if (bld.running) {
    el.build.textContent = "Compiling…";
    el.buildNote.textContent = "cargo build --profile diag is running. Leave it alone until it finishes.";
  } else {
    el.build.textContent = data.checks.build ? "Rebuild runtime" : "Build runtime";
    el.buildNote.textContent =
      bld.exit !== null
        ? bld.exit === 0
          ? "The runtime is built. Play works now."
          : `Last build exited with code ${bld.exit} — the log below says why.`
        : data.checks.build
          ? "Only needed after the runtime source changes."
          : "Builds victory.exe so Play has something to run.";
  }

  el.prebuild.disabled = busy;
  el.warm.disabled = busy;
  if (pre.running) {
    el.prebuild.textContent = "Building…";
    el.prebuildNote.textContent = "victory shaders --jobs 10 is running.";
  } else {
    el.prebuild.textContent = "Prebuild shaders";
    el.prebuildNote.textContent =
      pre.exit === null ? "Runs victory shaders --jobs 10 once; a few minutes."
      : pre.exit === 0 ? "Last build finished cleanly."
      : `Last build exited with code ${pre.exit}.`;
  }

  if (war.running) {
    el.warm.textContent = "Warming…";
    el.warmNote.textContent = "victory warm --used is running; a minute or so.";
  } else {
    el.warm.textContent = "Warm pipelines";
    el.warmNote.textContent =
      war.exit === null ? "Runs victory warm --used over the pipelines a recorded run wrote down; about a minute."
      : war.exit === 0 ? "Made the pipelines a recorded run wrote down."
      : `Nothing was made: no run has recorded its pipelines yet (exit ${war.exit}). Settings → Record pipelines, play a little, then warm.`;
  }

  // One console: show whichever of the three was used last.
  const chosen = [pre, war, bld]
    .filter((job) => job.logPath)
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0];
  const shown = chosen ?? pre;
  if (shown.logPath) el.wsLogName.textContent = shown.logPath.split(/[\\/]/).pop();
  if (shown.log.length) {
    el.wsLog.textContent = shown.log.filter((line) => line.trim() !== "").slice(-40).join("\n");
    el.wsLog.scrollTop = el.wsLog.scrollHeight;
  }

  if (!drawn) drawSettings();
}

function drawSettings() {
  drawn = true;

  el.cmdList.innerHTML = "";
  for (const m of data.modes) {
    const row = document.createElement("div");
    row.className = "cmd";
    row.innerHTML = `
      <div class="cmd-top">
        <span class="cmd-name">${m.name}</span>
        <span class="cmd-sub">${m.badge.toLowerCase()}</span>
        <button class="cmd-copy" type="button">copy</button>
      </div>
      <code></code>`;
    row.querySelector("code").textContent = m.command;
    const copy = row.querySelector(".cmd-copy");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(m.command);
        copy.textContent = "copied";
      } catch {
        copy.textContent = "select it";
      }
      setTimeout(() => (copy.textContent = "copy"), 1400);
    });
    el.cmdList.append(row);
  }

  const rows = [
    ["game", data.paths.game, data.checks.game],
    ["build", data.paths.build, data.checks.build],
    ["script", data.paths.script, data.checks.script],
    ["fidelityfx", data.paths.ffx, data.checks.ffx],
    ["config", data.paths.config, data.checks.config],
    ["logs", data.paths.logs, true],
  ];
  el.paths.innerHTML = "";
  for (const [key, value, ok] of rows) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="${ok ? "p-ok" : "p-bad"}"></span><span class="p-key">${key}</span><span class="p-val"></span>`;
    li.querySelector(".p-val").textContent = value;
    el.paths.append(li);
  }
}

/* ---------- polling ---------- */

async function poll() {
  clearTimeout(pollTimer);
  const next = await api("/api/state");
  if (next.app === "victory-launcher") {
    data = next;
    renderMode();
    render();
  } else if (data) {
    setRunline(next.error ?? "the launcher server is not answering", "is-error");
  }
  pollTimer = setTimeout(poll, data?.running || data?.busy ? 1200 : 4000);
}

/* ---------- actions ---------- */

el.play.addEventListener("click", async () => {
  if (data?.running) {
    setRunline("Stopping…", "is-running");
    const res = await api("/api/stop", {});
    if (res.error) setRunline(res.error, "is-error");
  } else {
    setMenu(false);
    setRunline("Starting…", "is-running");
    const res = await api("/api/play", { mode });
    if (res.error) {
      setRunline(res.error, "is-error");
      el.play.disabled = false;
      return;
    }
    el.console.classList.add("is-open");
    $(".console-more", el.console).textContent = "collapse";
  }
  poll();
});

el.build.addEventListener("click", async () => {
  el.build.disabled = true;
  const res = await api("/api/build", {});
  if (res.error) {
    el.buildNote.textContent = res.error;
    el.build.disabled = false;
    return;
  }
  el.wsConsole.classList.add("is-open");
  $(".console-more", el.wsConsole).textContent = "collapse";
  poll();
});

el.prebuild.addEventListener("click", async () => {
  el.prebuild.disabled = true;
  const res = await api("/api/prebuild", {});
  if (res.error) {
    el.prebuildNote.textContent = res.error;
    el.prebuild.disabled = false;
    return;
  }
  el.wsConsole.classList.add("is-open");
  $(".console-more", el.wsConsole).textContent = "collapse";
  poll();
});

el.pickGame.addEventListener("click", async () => {
  el.pickGame.disabled = true;
  el.pickGame.textContent = "waiting for the folder dialog…";
  el.gameNote.textContent = "";
  const res = await api("/api/game-dir", {});
  el.pickGame.disabled = false;
  el.pickGame.textContent = "Choose folder…";
  if (res.error) el.gameNote.textContent = res.error;
  else if (res.cancelled) el.gameNote.textContent = "Nothing was picked; the folder is unchanged.";
  else el.gameNote.textContent = "Saved. Play uses it from now on.";
  poll();
});

el.memoryToggle.addEventListener("click", async () => {
  el.memoryToggle.disabled = true;
  const res = await api("/api/memory-stack", { on: !data?.memoryStack });
  el.memoryToggle.disabled = false;
  if (res.error) el.memoryNote.textContent = res.error;
  poll();
});

el.recordToggle.addEventListener("click", async () => {
  el.recordToggle.disabled = true;
  const res = await api("/api/record", { on: !data?.record });
  el.recordToggle.disabled = false;
  if (res.error) el.recordNote.textContent = res.error;
  poll();
});

el.prebuildToggle.addEventListener("click", async () => {
  el.prebuildToggle.disabled = true;
  const res = await api("/api/prebuild-before-play", { on: !data?.prebuildBeforePlay });
  el.prebuildToggle.disabled = false;
  if (res.error) el.prebuildBeforeNote.textContent = res.error;
  poll();
});

el.warm.addEventListener("click", async () => {
  el.warm.disabled = true;
  const res = await api("/api/warm", {});
  if (res.error) {
    el.warmNote.textContent = res.error;
    el.warm.disabled = false;
  }
  poll();
});

$$("[data-open]").forEach((button) =>
  button.addEventListener("click", async () => {
    const res = await api("/api/open", { target: button.dataset.open });
    if (res.error) button.textContent = res.error;
  }),
);

$("#quit").addEventListener("click", async () => {
  await api("/api/quit", {});
  setTimeout(() => window.close(), 150);
});

tickTimer = setInterval(() => {
  if (data?.running) showRunline();
}, 1000);

$$(".view").forEach((view, i) => {
  if (i > 0) {
    view.inert = true;
    view.setAttribute("aria-hidden", "true");
  }
});
renderMode();
poll();
requestAnimationFrame(() => movePill($(".tab.is-active")));
