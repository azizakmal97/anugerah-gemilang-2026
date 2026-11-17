---
name: design-system
description: Apply consistent visual design tokens. Auto-triggers when building UI. Invoke manually with /design-system.
user-invocable: true
---

# Design System: Anugerah Gemilang 2026

Direction comes from the event poster (navy ballroom, gold batik frame, theme "Nusantara Batik").
Dark only, by the owner's choice. The source of truth is `:root` in `style.css`; this file
explains the reasons. Never write a raw hex outside `:root`.

## Colour tokens

| Token | Value | Why |
|---|---|---|
| `--navy-deep` | `#060e26` | Page edge and card background: the poster's night sky |
| `--navy` | `#0b1736` | Main background |
| `--navy-raised` | `#142a5a` | Top glow of the page gradient, under the hero |
| `--gold` | `#d6a84e` | Lines, headings, motifs: the poster's batik gold |
| `--gold-light` | `#f2d796` | Big titles and the primary button: highest emphasis |
| `--sogan` | `#7a3f1d` | Batik sogan brown: curtain cloths, rebung strips, best-dressed card |
| `--sogan-deep` | `#4e2610` | Shadow side of the sogan cloth |
| `--cream` | `#f6eedb` | Body text |
| `--cream-muted` | `#d9cfb8` | Secondary text (still above 4.5:1 on navy) |

Three cores (navy, gold, sogan) plus cream text. Gold is the accent: the one pill button is the
only solid gold block on the page.

## Type

| Token | Font | Use |
|---|---|---|
| `--font-display` | Cinzel | Titles and headings, matches the poster lettering |
| `--font-script` | Great Vibes | Tagline, "Best-Dressed", footer sign-off; never body text |
| `--font-body` | Source Sans 3 | Everything else; readable at small sizes on cheap phones |

Sizes use `clamp()` so phones get a smaller step.

## Motifs (the identity, reuse them, do not add new ones)

- **Kawung** (four petals): wallpaper, timeline nodes, curtain flower, medallion middle ring.
- **Pucuk rebung** (bamboo-shoot triangles): strips on the action card, medallion outer ring.
- **Parang** (diagonal blades): the two scroll-linked bands between sections.

## Shape and depth

- Radius: 6px cards, 4px small boxes, 2px the cloth swatch. One pill: the primary action button.
- Shadow: only the action card is lifted (it is the task). Everything else sits flat.

## Motion

- Once: curtain parts, ornament draws, title shimmer, tagline written left to right, heading rules.
- Scroll-linked: batik drift, parang bands, gold thread, cloth swatch straightening.
- Endless (owner request, R-19 waiver in `style.css`): medallion rings, gold dust.
- All motion stops under `prefers-reduced-motion`.
