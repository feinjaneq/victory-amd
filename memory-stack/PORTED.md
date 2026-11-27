# What of the memory stack is in this fork

`patches/`, `MEMORY_STACK.md` and `AGENTS.md` here are an unmodified copy of
[`skornuta/victory-memory-stack`](https://github.com/skornuta/victory-memory-stack)
(27 patches, cut against `e94251a` of that author's fork). This file records what of it
was ported into the gleaf-6 fork in `_gl79/` and `fork/`, and what was not.

The series does not apply here: `_gl79` is the gleaf-6 fork at `bf24b1a`, `host.rs` had
moved a long way from the base, and the patches are a specification rather than a
merge. Every ported switch is still **off** in the runtime; `-MemoryStack` in
`scripts/play-rx6600.ps1` (the Settings → Memory stack toggle) is what turns them on,
and without it every code path is the one it was before.

## Ported

All three are in `crates/victory-gpu/src/host.rs`, adapted to this fork's structures
(`Mutex`-held allocator, lazy prelude, the card copy of the indirect budget):

| Switch | What it does here |
| --- | --- |
| `VICTORY_ALLOCATOR_TRIM=1` (+ `VICTORY_ALLOCATOR_TRIM_S`, 30) | A host list's reset, and a prelude's before it records again, take a new command allocator once the old one is 30 s old; the old one goes behind the submissions still running. |
| `VICTORY_PRELUDE_POOL=1` | Host lists' preludes come from one shared pool instead of one per list; a pooled prelude is tagged with its submission's fence on both send paths and given back once that submission has run. At most 64 idle ones are kept. |
| `VICTORY_BUDGET_PACK=1` | A list's 256-byte indirect-work budget is a slot of a shared 64 KiB buffer (zeroed when taken, given back through `retire`) instead of a 64 KiB committed buffer of its own. The order for the buffer keeps its CPU-mapped budget; the card copy still gets the notes copied at the list's close, at the slot's offset. |

Checks run here: `cargo build --locked --profile diag -p victory --features diagnostics`
passes, and `cargo test --locked --profile diag -p victory-gpu --lib` gives 333 passed,
3 failed. Those same three fail on the fork **before** this port
(`descriptor::host::tests::views_are_made_beside_the_heap_and_copied_in`,
`indirect::tests::host_list_budget_starts_empty_at_each_submission`,
`indirect::tests::warp_batch_charges_every_execution`), so they are this fork's, not the
port's.

## Not ported

| Group | Patches | Why not |
| --- | --- | --- |
| Slot eviction | 0006, 0007 | Reaches into `resource.rs` and `descriptor.rs`, which this fork has reworked. 0007 is the deadlock fix 0006 needs, and a deadlock cannot be checked by the tests here; half of it would be worse than none. |
| Bindless usage feedback | 0009–0012 | Changes translated shaders (`emit/shader.rs`) and needs a pipeline library file of its own; this fork's emitter and library are not the base's. |
| GPU detile + ring trim | 0001, 0003, 0014, 0015 | The largest group: a new compute pass and a reworked texture upload route (`texture.rs`, `texture/ahead.rs`), both this fork's own. |
| Memory telemetry | 0004, 0005, 0017 | Written for `ramline.rs`/`memtel.rs`, which this fork does not have; its memory map is `copystat.rs`. |
| Compare in pieces | 0024 | Hangs off `Shadow::copy_now`, which this fork does not have in that shape. |

Two switches in the launcher's set do nothing in this fork, because it has no such
switches: `VICTORY_STAGE_POOL_MB` and `VICTORY_CARD_WINDOW_UPLOAD_MB`. They are still
set with the rest, so a later port of them needs no launcher change.

## Not measured

Nothing here was measured on this machine. The stack's numbers (RTX 5080 16 GB,
12.6 → 8.55 GB VRAM) are its author's, not this fork's, and most of what they depend on
is not ported. To measure what did land: run three minutes in the world with a warm
shader cache, once with Settings → Memory stack off and once on, and read "Card memory"
on the Games tab (and the memory map in the run log). Until then the honest label is
"ported, not measured".
