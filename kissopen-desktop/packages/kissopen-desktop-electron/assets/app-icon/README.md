# Application icon assets

The app icon is the 一起卷 / WorPar 卷 mark in its framed form, from the product
owner's design: a rounded square (corner = side × 0.225) filled with a
neutral-700 → neutral-900 gradient (`#3A3C50` → `#1B1D2C`), the purple roll
(`#9184D9`, with a soft glow) entering from its left edge and rolling into a
spiral, and the grey paper back line (`#6E7084`) below it, both clipped to the
square. The geometry lives in `scripts/brand-mark.mjs` (and, for the interface,
`kissopen-desktop-ui/src/kissopenMarkGeometry.ts`). Every size is drawn for its
own size, because the mark simplifies as it shrinks: the full four half-turns
from 96px, one and a half turns from 40px, and a back-less hook below that.

`windows-mark.svg` is the full-size tile on its 120 grid. Regenerate the runtime
`generated/app-icon.png` and the Windows executable / installer
`generated/app-icon.ico` (16, 20, 24, 32, 40, 48, 64, 128, 256 pixels):

```sh
pnpm desktop:assets:windows
```

Regenerate the macOS `generated/app-icon-mac.png`, `generated/app-icon.icns` and
the Dock tiles `generated/dock-light.png` / `generated/dock-dark.png` (the design
has one tile for every appearance, so both are the same) on macOS:

```sh
pnpm desktop:assets
```

`source.png` is a copy of the 1024 × 1024 macOS tile, kept for reference. The
root legacy brand-sync script does not own these Electron application icon
assets and must not be run.
