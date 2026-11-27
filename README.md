# Retail Game launcher

One window with one **Play** button: it starts Retail Game through the VIctory
runtime in `_gl79/`, and shows you the frame rate while it runs. Nothing is
installed system-wide and nothing touches the internet — it is a small local
page served by Bun on `127.0.0.1`.

## Quick start

1. Double-click **`start-launcher.cmd`**.
2. Go to **Settings** and press **Choose folder…** to pick the folder your copy
   of the game is in. Skip this when the launcher already finds it.
3. Go to the **Workshop** tab and press **Build runtime** (first time only; it
   takes a while).
4. Back on **Games**, press **Play**.

That is it. You do not need to create `_gl79`, copy any folder, or edit any
config: on startup the launcher copies the runtime source from `fork/` into
`_gl79/` if it is not there, and creates `_gl79/victory.toml` if that is
missing. Neither step ever overwrites something that already exists.

**What you need first:** Windows 10/11, [Bun](https://bun.sh) on `PATH` (the
`.cmd` also looks for the copy bundled with Freebuff Desktop), Rust and the
Visual Studio C++ build tools for step 2, and your own copy of the game.

## The two modes

The arrow next to **Play** picks one:

| Mode | What it is |
| --- | --- |
| **Optimized** (recommended) | 1280×720, Series S profile, PC FidelityFX (FSR 4.1.2) plus a generated frame between real ones. Needs the FidelityFX folder. |
| **Normal** | 1920×1080, Series X profile, no upscaler and no generated frames. Works without FidelityFX, and is much slower. |

Tuned for a Radeon RX 6600 8 GB; other cards run, just not as documented here.

## Memory stack

**Settings → Memory stack** turns on the switches from
[`memory-stack/`](memory-stack/MEMORY_STACK.md) for a run. Each one is **off in the
runtime itself**, so with the toggle off nothing about the run changes. Three are
ported into this fork — allocator trim, prelude pool, budget pack — and
[`memory-stack/PORTED.md`](memory-stack/PORTED.md) says what landed, what did not and
why. None of it has been measured on this card: run it once with the toggle off and
once on and read **Card memory** on the Games tab.

## The tabs

- **Games** — Play, the mode picker, live frame rate / frame time / card
  memory / shader cache, and the run log (click its header to expand).
- **Workshop** — **Build runtime** (compiles `victory.exe`), **Prebuild
  shaders** (fills the shader cache so a run does not start by compiling),
  cache size, and the compiler log.
- **Settings** — the two exact command lines Play runs (with `-MemoryStack` when
  the toggle is on), every path the launcher uses with a dot for whether it was
  found, **Choose folder…** for the game folder, and the memory stack toggle.

**Stop** ends the run and everything it started. **Quit** (bottom left) closes
the window and the server. Closing the window alone is enough too: two minutes
later the server exits by itself.

## If Play will not start

| Message | Fix |
| --- | --- |
| `missing build` | Press **Workshop → Build runtime**. If you built in a terminal and it landed in `target\debug`, that was a plain `cargo build` — Play needs `--profile diag`. |
| `missing game` | The game folder is not the right one. Press **Settings → Choose folder…** and pick the folder that has the game executable. |
| `missing FidelityFX` | Optimized mode needs `ffx\Kits\FidelityFX\signedbin`. Use Normal mode, or restore that folder. |
| World is black in Optimized | Same cause: without the upscaler the Series S profile has nothing to answer it. Use Normal. |
| Message box about `bun.exe` | Bun is not installed and not in the Freebuff folder. Install Bun. |
| Window opens on an odd port | Something else holds `7788`; the launcher walks up to `7799`. |

Logs are in `gl79-data\launcher\`: the newest run log, plus the build and
prebuild logs. A run's log replaces the previous one as the new session starts.

## Build by hand

The Workshop button runs exactly this:

```powershell
cd _gl79
cargo build --locked --profile diag -p victory --features diagnostics
```

It writes `_gl79\target\diag\victory.exe`, which is what Play looks for. The
first build is slow (Rust compiles everything from scratch); later ones only
rebuild what changed. You need [Rust](https://rustup.rs) — the repo pins 1.98.1
and rustup fetches it — and Visual Studio Build Tools with *Desktop development
with C++* and a Windows SDK. A `--profile release` build is picked up too; a
`cargo build` without a profile is not.

## How it works, briefly

```
start-launcher.cmd -> bun launcher/server.ts -> http://127.0.0.1:7788
                                                (opens as its own app window)
```

Play starts `powershell -File _gl79\scripts\play-rx6600.ps1 -Exe <game> <mode
switches>`, which sets the `VICTORY_*` variables the runtime reads and runs
`victory.exe run <game.exe>`. The server streams that output into a log and
parses the numbers it prints into the stat cards. One job at a time: no build
while a run is going, no run while a build is going.

## Where the paths are

The game folder is whatever **Settings → Choose folder…** last saved, in
`gl79-data/settings.json`; until something is saved the launcher uses the folder it
was written for. The rest is one object at the top of `launcher\server.ts` (the script,
the build, the config, `ffx/`, the shader cache, the logs). The Settings tab shows the
same values with a dot for whether each one resolves.

## What is in this folder

```
start-launcher.cmd      entry point; finds bun, starts the server hidden
launcher/               the server (server.ts), the folder picker, the window (public/)
_gl79/                  the runtime source (not in git; copied from fork/)
fork/                   snapshot of the runtime source
memory-stack/           the memory stack: patches, its docs, and PORTED.md
attic/                  patches from experiments that were removed
gl79-data/              shader cache, run logs and settings.json (not backed up)
ffx/                    FidelityFX binaries (not backed up)
```

`AGENTS.md` is the short version of this map for tooling.
