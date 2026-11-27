# GTA VI launcher (RX 6600)

A local launcher window for the `gleaf-6/VIctory-7900XTX-` fork. It serves a
page on 127.0.0.1 and runs the fork's own 8 GB script in one of two modes:

- **Optimized** — `_gl79/scripts/play-rx7600.ps1 -SeriesS -Resolution 1280x720
  -FidelityFxDir ffx\Kits\FidelityFX\signedbin -Stats` (FSR + frame generation)
- **Normal** — the same script with `-SeriesX -Resolution 1920x1080 -Stats`
  (no upscaler, no generated frames)

```
start-launcher.cmd          entry point; starts launcher/server.ts with bun
launcher/server.ts          Bun server: state, play, stop, prebuild, logs
launcher/public/            the window (HTML/CSS/JS, hero art)
gl79-data/launcher/         run and prebuild logs, one file per run
attic/                      patches of work that lived in the removed forks
```

Paths the launcher uses, all local and outside this repository:
`C:\Users\Janeq\Downloads\GTA6.Xbox.v1.0.2.1-CYBERLEEK\game_scarlett_master.exe`,
`_gl79/target/diag/victory.exe`, `ffx/Kits/FidelityFX/signedbin`.

`_gl79/` is its own git clone with its own remote; `ffx/` and
`gl79-data/cache-gl79/` are ignored because they are large and rebuildable.

## After every build

Commit the change and push it to GitHub
(`git push origin main`, remote `feinjaneq/victory-gta6-launcher`). Do this
after each new build, not only at the end of a session.
