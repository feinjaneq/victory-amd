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
launcher/server.ts          Bun server: state, play, stop, prebuild, logs
launcher/public/            the window (HTML/CSS/JS, hero art)
gl79-data/launcher/         run and prebuild logs, one file per run
fork/                       snapshot of the fork's source at the build commit
attic/                      patches of work that lived in the removed forks
```

What is not uploaded: build outputs (`_gl79/target/`), the FidelityFX binaries,
the shader cache (`gl79-data/cache-gl79/`), the game's saved profile and the
browser profile. The live checkout in `_gl79/` is the fork's own git clone with
its own remote; `fork/` is the plain snapshot kept here as a backup.

Paths the launcher uses stay outside this repository:
the dumped game folder `C:\Users\Janeq\Downloads\GTA6.Xbox.v1.0.2.1-CYBERLEEK\`
(its executable is `game_scarlett_master.exe`), `_gl79/target/diag/victory.exe`,
`ffx/Kits/FidelityFX/signedbin`. The UI calls the title "Retail Game" and never
uses its real name.

## After every build

Commit the change and push it to GitHub
(`git push origin main`, remote `feinjaneq/victory-gta6-launcher`). Do this
after each new build, not only at the end of a session.
