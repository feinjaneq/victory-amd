# Victory — Retail Game launcher

A small window that starts **Retail Game** on this PC with one press of **Play**.
It is not a game engine and it does not change any settings of its own: it opens
the game (through the VIctory runtime in `_gl79/`) in one of two ready-made
profiles and shows you what the runtime reports while it runs.

```
start-launcher.cmd  ->  bun launcher/server.ts  ->  http://127.0.0.1:7788
                                                     (opens as its own app window)
```

Nothing is installed system-wide, nothing runs at login, and nothing talks to
the internet. Close the window and the local server exits on its own.

---

## 1. What you need

- Windows 10 or 11, 64-bit.
- A Radeon RX 6600 8 GB (you dont have to but its tuned for it), a good cpu (like a Ryzen 5 5600) and atleast 16GB of RAM (the profile this
  launcher is tuned for; other hardware will run, just not as documented here).
- [Bun](https://bun.sh) on `PATH`. If you do not have it, `start-launcher.cmd`
  looks for the copy bundled with Freebuff Desktop and shows a message box if it
  finds nothing.
- The runtime build: `_gl79\target\diag\victory.exe` (see **Build** below).
- Your own copy of the game, at the path the launcher is configured to use
  (see **Where the paths are** below).
- For the optimized profile only: the PC FidelityFX SDK folder that contains
  `amd_fidelityfx_upscaler_dx12.dll` (`ffx\Kits\FidelityFX\signedbin` here).

## 2. How it works

1. You double-click **`start-launcher.cmd`**. It re-launches itself hidden so
   no console stays on screen, finds `bun`, and starts `launcher/server.ts`.
2. The server listens on `127.0.0.1`, first free port in `7788–7799`, and opens
   the page as a chromeless app window (Edge, then Chrome, then your default
   browser). The window has its own profile in `launcher/.window`, so it never
   shares your normal browser session.
3. **Play** starts one PowerShell child process:

   ```
   powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden ^
     -File _gl79\scripts\play-rx6600.ps1 -Exe <game executable> <mode switches>
   ```

   That script is the fork's tuning profile: it sets the `VICTORY_*` variables
   the runtime reads and then launches `victory.exe run <game.exe>`.
4. The server streams that process's output into a log file under
   `gl79-data\launcher\`, and parses the numbers it prints (`n fps, m ms/frame`,
   card memory) into the stat cards you see.
5. **Stop** kills the whole process tree. Closing the window stops nothing —
   but with no page polling for two minutes and no run in progress, the server
   exits and takes the runtime with it.
6. If the launcher is already running, double-clicking the `.cmd` again just
   brings the existing window forward instead of starting a second server.

## 3. How to use it

Double-click **`start-launcher.cmd`**.

### Games tab

- **Play** — starts the selected mode. The button turns into a stop action and
  the status line under it shows what is happening.
- **The small arrow next to Play** — picks the mode:
  - **Optimized (recommended)** — Series S profile, 1280×720, PC FidelityFX
    (FSR 4.1.2) plus a generated frame between real ones. The lighter profile:
    it needs the FidelityFX folder and it is the one to use.
  - **Normal (unoptimized)** — Series X profile, 1920×1080, no upscaler and no
    generated frames. The plain run: it works without the FidelityFX folder,
    and it is much slower.
- **Frame rate / Frame time / Card memory / Shader cache** — read live from the
  running process's output.
- **Run log** — the tail of the current run's log. Click the header to expand it
  to full height; click again to collapse.

### Workshop tab

- Shows how many files are in the shader cache and how much space they take
  (`gl79-data\cache-gl79`), with buttons to open the cache folder and the log
  folder.
- **Prebuild shaders** runs `victory.exe shaders --jobs 10` once, so the first
  minutes of a real run are not spent compiling pipelines. It takes a few
  minutes and its output streams into the log panel on that page.

### Settings tab

- The two exact command lines Play uses — the same text the launcher runs, with
  no hidden switches. Useful when you want to run something by hand.
- The paths the launcher uses, and whether each one was found.
- **Quit** (bottom of the sidebar) closes the window and the server.

## 4. Build

Build the runtime, not the launcher — the launcher is plain HTML/CSS/JS served
by Bun and needs no build step.

```powershell
cd _gl79
cargo build --locked --profile diag -p victory --features diagnostics
```

That produces `_gl79\target\diag\victory.exe`, which is exactly what the
launcher checks for before it lets you press Play. Build once, and rebuild only
when the runtime source changes. While a run is in progress the launcher refuses
to start a build job at the same time (one job at a time, ever).

If you rebuild into `target\release` instead, change `-Build diag` to
`-Build release` in the mode's arguments, or run the script by hand:

```powershell
cd _gl79
scripts\play-rx6600.ps1 -Exe "<path to the game executable>" -Build release
```

## 5. Where the paths are

Everything the launcher needs to know lives in one object at the top of
`launcher\server.ts`:

| Constant | What it is |
| --- | --- |
| `GAME_DIR` | Folder holding the game executable |
| `P.script` | `_gl79\scripts\play-rx6600.ps1` — the profile Play runs |
| `P.build` | `_gl79\target\diag\victory.exe` |
| `P.config` | `_gl79\victory.toml` |
| `P.ffx` | `ffx\Kits\FidelityFX\signedbin` (upscaler + frame generation) |
| `P.cache` | `gl79-data\cache-gl79` — the shader cache |
| `P.logs` | `gl79-data\launcher` — one log per run |

Change them there (they are also passed to the runtime as `VICTORY_CONFIG`,
`VICTORY_CACHE_DIR` and `VICTORY_DATA_DIR`), then close and reopen the launcher:
the Settings tab shows the same values, so you can see immediately whether each
path resolves.

Nothing outside this folder is written except the run's own data in
`gl79-data\`.

## 6. If something goes wrong

| What you see | What it means |
| --- | --- |
| A message box about `bun.exe` | Bun is not on `PATH` and not in the Freebuff folder. Install Bun, or set `FREEBUFF_BUN` to `bun.exe`. |
| Play says **missing script** | `_gl79\scripts\play-rx6600.ps1` is gone — re-clone the fork into `_gl79`. |
| Play says **missing build** | Build the runtime (see **Build**). |
| Play says **missing FidelityFX** | Optimized mode needs `ffx\Kits\FidelityFX\signedbin\amd_fidelityfx_upscaler_dx12.dll`. Use Normal mode, or restore that folder. |
| The world comes out black in Optimized | Same cause: without the upscaler the Series S profile has nothing to answer it. Normal mode renders on its own. |
| The window opens on a strange port | Another program holds `7788`; the server walks up to `7799`. |
| Nothing happens on double-click | Check `launcher\server.log` (the `.cmd` appends to it) and the newest file in `gl79-data\launcher\`. |

## 7. What is in this folder

```
start-launcher.cmd      entry point; finds bun, starts the server hidden
launcher/server.ts      the whole backend: state, play, stop, prebuild, logs
launcher/public/        the window (HTML, CSS, JS, hero art)
_gl79/                  the VIctory runtime checkout (its own git clone)
_gl79/scripts/          play-rx6600.ps1 and friends
fork/                   plain snapshot of the runtime source, kept as a backup
attic/                  patches from experiments that were removed
gl79-data/              shader cache and run logs (not backed up)
ffx/                    FidelityFX SDK binaries (not backed up)
```

`AGENTS.md` has the short version of the same map for tooling, including what
gets pushed to GitHub.
