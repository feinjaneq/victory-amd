# Retail Game launcher (Radeon RX 6600 8 GB)

A local launcher window for the gleaf-6 VIctory fork, running on this machine's
RX 6600 / Ryzen 5 5600 / 32 GB. It serves a page on 127.0.0.1 and runs the
fork's own 8 GB script in one of two modes, both in English:

- **Optimized** — `_gl79/scripts/play-rx6600.ps1 -SeriesS -Resolution 1280x720
  -FidelityFxDir ffx\Kits\FidelityFX\signedbin -Stats` (FSR + frame generation)
- **Normal** — the same script with `-SeriesX -Resolution 1920x1080 -Stats`
  (no upscaler, no generated frames)

```
start-launcher.cmd          entry point; starts launcher/server.ts with bun
prebuild-shaders.cmd        shader cache + Warm pipelines, from a terminal
diagnose.cmd                one session: frame-time numbers and popwatch pictures
launcher/server.ts          Bun server: state, play, stop, prebuild, warm, build, logs
launcher/prebuild.ps1       the prebuild-shaders.cmd work
launcher/diagnose.ps1       the diagnose.cmd work
launcher/pick-folder.ps1    the native folder dialog behind Settings
launcher/public/            the window (HTML/CSS/JS, hero art)
gl79-data/launcher/         run and prebuild logs, one file per run
memory-stack/               skornuta/victory-memory-stack, and PORTED.md
fork/                       snapshot of the fork's source at the build commit
attic/                      patches of work that lived in the removed forks
```

What is not uploaded: build outputs (`_gl79/target/`), the FidelityFX binaries,
the shader cache (`gl79-data/cache-gl79/`), the game's saved profile and the
browser profile. The live checkout in `_gl79/` is the fork's own git clone with
its own remote; `fork/` is the plain snapshot kept here as a backup.

The launcher sets `_gl79/` up itself: at startup it copies `fork/` into `_gl79/`
if that folder has no `Cargo.toml`, and copies `victory.example.toml` to
`victory.toml` if the config is missing (never overwriting either). `Workshop →
Build runtime` runs `cargo build --locked --profile diag -p victory --features
diagnostics` in `_gl79/`. Do not turn those back into manual README steps.

The game folder is chosen in the window: Settings → **Choose folder…** runs
`launcher/pick-folder.ps1`, the folder is saved in `gl79-data/settings.json` and
passed as `VICTORY_GAME_DIR`. Until something is saved, the launcher uses
`C:\Users\Janeq\Downloads\GTA6.Xbox.v1.0.2.1-CYBERLEEK\` (executable
`game_scarlett_master.exe`). Do not put a game path back into `server.ts` and do not
turn the button into a README step.

Pipelines still being made are what make a frame lose and regain its draws:
Settings → **Record pipelines** makes Play pass `-Record`, `Workshop → Warm
pipelines` (and `prebuild-shaders.cmd`) runs `victory warm --used` over what a
recorded run wrote down. Keep the recorded pipeline book with the cache, not in
this repository.

The memory stack lives in `memory-stack/` (patches + the author's docs + `PORTED.md`).
Its switches stay off in the runtime; Settings → Memory stack makes Play pass
`-MemoryStack`, which sets them in `scripts/play-rx6600.ps1`. Only allocator trim,
prelude pool and budget pack are ported into `host.rs` — read `PORTED.md` before adding
another group, and keep every group behind its switch.

Other paths stay outside this repository: `_gl79/target/diag/victory.exe` and
`ffx/Kits/FidelityFX/signedbin`. The UI calls the title "Retail Game" and never uses
its real name.

## After every build

Commit the change and push it to GitHub
(`git push origin main`, remote `feinjaneq/victory-amd`, private). Do this
after each new build, not only at the end of a session.
