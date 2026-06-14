# battle-v2 — Candidate Art Set (Urban Character Pack)

Staged alternative art for **课间大乱斗** (Phaser 3 side-scrolling beat-'em-up).
This is a **candidate / staging** folder only. No code references it yet, and the
existing `public/assets/battle-school/` (Kenney Toon Characters 1) is untouched.

---

## Source pack

- **Pack name:** Urban Character Pack
- **Author:** *DoodleOverlord* (a.k.a. *Cynical_Poet*)
- **Asset page:** https://opengameart.org/content/urban-character-pack
- **License:** **CC0 1.0 Universal (Public Domain)** — verified on the source page
  ("Royalty free images, free to use in anything anywhere."). No attribution required.
  https://creativecommons.org/publicdomain/zero/1.0/
- **Source file downloaded:**
  `Urban Character Pack large transparent_0.png` (the 8000×16320 large transparent sheet)
  https://opengameart.org/sites/default/files/Urban%20Character%20Pack%20large%20transparent_0.png
  - File verified real: `PNG image data, 8000 x 16320, 8-bit/color RGBA`.
  - The pack also ships a 1×-native sheet (`...small transparent...`, 1000×2040).
    The large sheet is an exact 8× nearest-neighbor upscale of the native art, so the
    true source resolution is **1000×2040**, with a **48×64 px** cell grid.

## What's in the pack (not all used)

31 modern/urban pixel characters + 36 items, all in **one consistent chunky pixel-art
style**. Per-character animation strip (20 frame columns) covering idle, walk, attack,
jump, battle-stance and hold poses. Frame grid on the native sheet:

- Horizontal: cells pitch **48 px**, first cell left edge at x≈12, 20 columns.
- Vertical: character bands pitch **64 px**, first band top at y≈12, ~56 px of content.

## How these PNGs were produced

Native sheet recovered (8000×16320 → 1000×2040, nearest). For each chosen character row,
8 pose frames were sliced from specific columns (see mapping below), bleed from
neighbouring frames removed via connected-component masking seeded on the central body
column, all 8 frames cropped to that character's **shared union bbox** (so the animation
stays registered), then upscaled **×4 nearest-neighbor** for crisp pixels. No recoloring
or redrawing — pure CC0 source pixels.

Pose → source column (validated on the hero row):
`idle=0, walk0=4, walk1=5, walk2=6, walk3=7, attack=13, jump=3, hurt=16`.

---

## Recommended role mapping (game character → source row)

| Game role | Reads as | Source row | Look |
| --- | --- | --- | --- |
| `hero`  | protagonist kid | 18 | blonde hair, red/pink hoodie, grey shorts |
| `mobA`  | classmate kid   | 3  | green shirt, blue shorts |
| `mobB`  | classmate kid   | 7  | pink shirt, blue shorts |
| `mobC`  | classmate kid   | 8  | yellow-striped shirt, blue shorts |
| `mobD`  | classmate kid   | 21 | cyan tee (pink graphic), white shorts |
| `mobE`  | bully kid       | 19 | green mohawk, yellow checkered shirt (distinct) |
| `boss1` | head teacher / principal | 28 | grey suit + **blue tie** (formal adult) |
| `boss2` | teacher         | 9  | brown jacket + tie, balding (classic teacher) |
| `boss3` | professor       | 22 | white hair + light/lab coat (elderly authority) |
| `boss4` | teacher         | 6  | black leather jacket + white shirt (strict adult) |

**Kid vs. adult is conveyed by costume**, not body scale (all sprites share the same
chunky proportions): kids wear bright casual tops + shorts; teachers wear suits, ties,
jackets, lab coats, and one has grey hair. This separation is clearer and more
theme-appropriate than the current set (whose "classmates" include a robot and a zombie).

## Frames per character (8 each)

`*_idle.png`, `*_walk0.png`, `*_walk1.png`, `*_walk2.png`, `*_walk3.png`,
`*_attack.png` (forward punch), `*_jump.png` (legs-spread airborne), `*_hurt.png` (recoil).

This mirrors the existing `battle-school` naming convention (note: current set uses
`attack2`; here it is `attack`).

## Staged files (80 total = 10 characters × 8 frames)

All files are RGBA PNG, ×4 upscaled. Canvas is uniform **per character** (so frames stay
registered); it varies slightly between characters because each uses its own union bbox.

| Character | Canvas (W×H) | Files |
| --- | --- | --- |
| hero  | 224×232 | hero_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| mobA  | 224×232 | mobA_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| mobB  | 224×224 | mobB_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| mobC  | 224×224 | mobC_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| mobD  | 224×224 | mobD_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| mobE  | 224×232 | mobE_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| boss1 | 224×224 | boss1_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| boss2 | 224×208 | boss2_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| boss3 | 224×232 | boss3_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |
| boss4 | 224×232 | boss4_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png |

(Per-file byte sizes are small — 0.9–1.1 KB — because flat-color pixel art upscaled with
nearest-neighbor compresses extremely well. Each frame was verified to contain
14,000+ opaque pixels, i.e. real artwork, not blank.)

## Gaps / caveats

- **No environment / biome art.** This pack has no ground tiles or backgrounds, so
  playground / forest / desert / snow / night tilesets are NOT included. A foreign tileset
  was deliberately not added because it would break the single-style consistency that is
  the top priority. (The pack's items row does include matching props/weapons — health
  cross, bats, etc. — which could be staged later if useful.)
- Kid-vs-teacher is by clothing, not body size (all sprites are the same proportions).
- `attack` is a forward-arm punch (moderate windup); it reads as an attack but is less
  exaggerated than a dedicated beat-'em-up swing.
- Optional extra poses available in-source but not staged: extra walk/run frames,
  weapon-hold, second jump/landing pose, side-reach attacks (columns 8–12, 14–19).

---

## Female cast (added)

The original 10 characters above all read as male or gender-neutral (short hair). This
section adds clearly **female-presenting** characters extracted from the **same** Urban
Character Pack (same CC0 source sheet, same recipe — recover native 1000×2040, slice the
8 pose columns `idle=0, walk0=4, walk1=5, walk2=6, walk3=7, attack=13, jump=3, hurt=16`,
connected-component mask seeded on the body trunk, shared per-character union bbox, ×4
nearest upscale). No recolor or redraw — pure CC0 source pixels.

**Important about this pack:** it is heavily male-skewed. After inspecting all 31 rows in
upright poses, **no row has long flowing hair**; femininity is conveyed by ponytails,
face-framing hair, and clothing (skirt / pink / pastel blouse) — which is the same kind of
costume-based cue the original "kid vs. teacher" split relies on. The five below are the
genuinely defensible female reads in this pack.

| Game role | Reads as | Source row | Female cues |
| --- | --- | --- | --- |
| `herog`  | protagonist girl     | 13 | blonde face-framing bob + cream cardigan + **pink top** + light-blue **skirt** (strongest, unambiguous) |
| `mobF`   | girl classmate       | 25 | yellow **side ponytail** + red sweater |
| `mobG`   | girl classmate (teen)| 14 | light hair + purple headband + white top with **pink heart** |
| `mobH`   | girl kid             | 29 | yellow **topknot ponytail** + all-pastel pink/lavender outfit (most childish/chibi; weakest read) |
| `bossF1` | female teacher / older woman | 23 | grey hair + pastel pink/lavender **striped blouse** (adult woman) |

### Rows considered but rejected (not clearly female)

- **Row 7** — bright pink sweater, but near-buzzed dark hair → reads as a heavyset boy in pink.
- **Row 24** — orange tousled hair + purple vest → boyish/neutral.
- **Row 30** — short hair + scarf/beanie + outdoor vest → neutral/male.
- Rows 0–12, 15–22, 26–28 — short-haired and/or male-coded (suits, ties, mohawks, muscle).

### Female cast files (40 total = 5 characters × 8 frames)

All RGBA PNG, ×4 nearest upscale, uniform canvas per character (frames stay registered).
Frame names mirror the rest of this folder: `*_{idle,walk0,walk1,walk2,walk3,attack,jump,hurt}.png`.

| Character | Source row | Canvas (W×H) | Opaque px / frame (min–max) |
| --- | --- | --- | --- |
| herog  | 13 | 224×216 | 12,672 – 22,784 |
| mobF   | 25 | 224×232 | 12,672 – 22,272 |
| mobG   | 14 | 224×232 | 13,952 – 24,320 |
| mobH   | 29 | 224×232 | 13,184 – 22,784 |
| bossF1 | 23 | 224×216 | 11,904 – 20,736 |

(Per-file byte sizes are ~0.8–1.0 KB, same as the existing set — flat-color pixel art
upscaled with nearest-neighbor compresses extremely well. Every frame was verified to
contain 11,900+ opaque pixels, i.e. real artwork, not blank.)

### Confidence

- `herog` (r13): **high** — skirt + pink top + face-framing bob, unmistakably a girl.
- `mobF` (r25), `bossF1` (r23): **medium-high** — ponytail / female-styled blouse are clear
  cues; hair itself is short in this chunky style.
- `mobG` (r14): **medium** — pink-heart top + headband lean female; hair is short.
- `mobH` (r29): **medium-low** — ponytail + pastel palette read as a girl kid, but the chibi
  proportions are gender-ambiguous; include only if a 5th girl is needed.

Net: this is a real, consistent female set drawn from the same pack — clearly distinct from
the male-ish original 10 — but the pack's limited female content means the read leans on
ponytails / skirt / pastels rather than long hair.
</content>
</invoke>
