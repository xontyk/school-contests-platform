---
name: Портал достижений лицея
description: A night-sky observatory where every verified lyceum achievement lights a star on the student's personal constellation map.
colors:
  space-deep: "#090d1f"
  space: "#121a3a"
  space-light: "#1c2757"
  star: "#ffcf6e"
  brand: "#7c6fff"
  brand-bright: "#9d93ff"
  brand-ink: "#4c3fd9"
  subj-physics: "#4fc3f7"
  subj-math: "#ff9f5e"
  subj-cs: "#4de8c0"
  state-approved: "#3ddc84"
  state-pending: "#ffcf6e"
  state-rejected: "#d9304f"
  surface: "#f5f7fc"
  surface-deep: "#e9edf8"
  card: "#ffffff"
  ink: "#141a33"
  ink-muted: "#5b6481"
  border: "#dbe0f0"
typography:
  display-hero:
    fontFamily: "Unbounded, Segoe UI, sans-serif"
    fontSize: "clamp(32px, 5vw, 52px)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  display-section:
    fontFamily: "Unbounded, Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.3
  numeral:
    fontFamily: "Unbounded, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    fontFeature: "tabular-nums"
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.55
  label:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    letterSpacing: "0.04em"
    textTransform: "uppercase"
rounded:
  xs: "6px"
  sm: "9px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  sm: "10px"
  md: "16px"
  lg: "22px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.brand-ink}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
    typography: "{typography.body}"
  button-star:
    backgroundColor: "{colors.star}"
    textColor: "{colors.space-deep}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-ghost:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-danger:
    backgroundColor: "{colors.state-rejected}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "22px"
  badge-status:
    rounded: "{rounded.xs}"
    typography: "{typography.label}"
  subject-tag:
    rounded: "{rounded.pill}"
  constellation-panel:
    backgroundColor: "{colors.space-deep}"
    rounded: "{rounded.md}"
---

# Портал достижений лицея — design system

## Overview

The world is a **night-sky observatory**. A lyceum student's verified
achievements are stars; the three subjects are constellations. Deep space
holds the shell (navbar, landing hero, auth page, the constellation panel);
the working surfaces where people read tables and fill forms stay on a cool,
light "night-sky paper" (`surface`), never cream. Colour does jobs, not
decoration: one gold for stars and achievement CTAs, one indigo for interface
actions, three disciplined subject colours, three state colours.

Platform: static web (HTML/CSS/vanilla JS). Modes: `index.html` is Persuade
(landing); `student.html` and `teacher.html` are Operate; `login.html` is a
Persuade-adjacent entrance sharing the space world.

## Colors

- **Space** (`space-deep` → `space` → `space-light`): the night sky. Only for
  the navbar, the landing hero and footer CTA, the auth background, and the
  constellation panel. Always a vertical gradient from lighter top to deeper
  bottom, with soft radial indigo/cyan glows layered on top.
- **Star** (`star`): achievement gold. Primary CTAs that start or advance the
  "light a star" story (Регистрация, Войти, Добавить достижение, Одобрить),
  hero accent words, rank-1 medal, the "pending" state (a star not yet lit).
- **Brand** (`brand`, `brand-bright`): indigo accent for icons, focus rings,
  borders, large numerals. **`brand-ink`** is the same hue darkened for any
  *text* or *text-bearing background* below 18.66px bold / 24px regular — it
  measures 6.95:1 against white, where `brand` only reaches 3.77:1.
- **Subjects**: physics `subj-physics` (cyan), math `subj-math` (orange),
  computer science `subj-cs` (mint). Used identically on subject tags, stat
  plaques and constellation clusters — never repurposed for anything else.
  Projects/volunteering without a subject use a neutral lavender-grey `#9aa3c7`.
- **States**: `state-approved` green, `state-pending` = `star`,
  `state-rejected` `#d9304f` (darkened from an earlier `#ef5a72` so white text
  on it passes AA at 4.68:1). Status badges use a ~15% tint of the state colour
  as background with a darker same-hue text.
- **Neutrals**: `surface` page ground, `surface-deep` for alternate sections
  and hover rows, `card` white, `ink` / `ink-muted` text, `border` hairlines.

## Typography

- **Unbounded** (self-hosted variable font, `font-weight: 200 900`) — the
  observatory signage voice: h1–h3, the navbar wordmark, stat numerals, step
  numbers, the demo verification code. Weight 600 by default.
- **Manrope** (self-hosted variable font, `font-weight: 200 800`) — all
  interface and body text. 500 body, 600–700 controls, 700 uppercase labels.
- Both families were checked for real Cyrillic coverage against the live
  Google Fonts CSS2 response before adoption (a previous world in this repo
  shipped a display face with no Cyrillic, silently falling back to Georgia).
- Fonts are served from `assets/fonts/` — one `.woff2` per Unicode subset
  (cyrillic, cyrillic-ext, latin) per family. Declare weights as a **range**,
  never as discrete values: Google serves the same variable file for every
  discrete weight, and discrete `font-weight` declarations collapse all bolds
  to the default instance.
- Numerals in tables, stats and points use `tabular-nums`.

## Layout & spacing

Container max 1160px with 20px gutters. Sections breathe at 64px on the
landing, 30px inside the apps. Card padding 22px. Below 640px the navbar
stacks and paired form fields collapse to one column; tables scroll
horizontally inside `.table-wrap` instead of squashing.

## Shapes & depth

Radii: 6px badges, 9px buttons and inputs, 14px cards and panels, 16–20px
modal and auth card, pills for tabs/tags/avatars. Depth is soft and offset:
`--shadow-card` (1px + 10px/24px blur, slight y-offset) on light surfaces,
`--shadow-raised` for the navbar, panels, modals and toasts. No hard offset
shadows, no glass.

## Components

- **Navbar**: space gradient, Unbounded wordmark with the orbit icon in
  `star`, pill links (active = `brand-ink` fill, white text).
- **Buttons**: `.btn` (brand-ink), `.btn--star` (gold, dark text — story
  actions), `.btn--ghost` (white, bordered), `.btn--danger` (rejected red).
- **Badges & tags**: fixed-min-width uppercase status badges; rounded subject
  pills tinted with their subject colour.
- **Tables**: uppercase muted headers, hairline rows, hover `surface-deep`.
  Rating rows 1–3 carry gold/silver/bronze rank pills; the viewer's own row
  is tinted indigo and marked «(вы)».
- **Stat plaques**: white cards with an Unbounded numeral coloured by subject
  (total uses `brand`).
- **Modals**: white, 16px radius, indigo hairline, space-tinted scrim.
- **Toasts**: space background, gold star icon; error variant in rejected red.
- **Icons**: one hand-authored inline SVG sprite (`js/common.js`), 24×24,
  1.6 stroke, round caps. No emoji as icons.
- **Feature cards / auth heading**: icon sits inline beside the heading,
  never as a tile stacked above it.

## Signature: the constellation map

`js/constellation.js` renders only **approved** achievements as stars on a
760×300 SVG inside the space panel on student.html → «Моя карта». Four
clusters (physics, math, cs, projects & volunteering) sit left to right;
each star's radius grows with points, a faint same-colour halo surrounds it,
and stars within a cluster are joined by a 35%-opacity polyline. Positions
are derived from a hash of the achievement id, so the map never jumps
between renders. Each star twinkles (`star-twinkle`, opacity .88↔1 with a
slight brightness lift, 3.2s) with a per-star delay from the same hash, so
stars never pulse in unison. Cluster labels are drawn in-SVG on wide
screens and hidden below 820px, where the legend above the map carries the
cluster names. The device lives only on this tab — dashboards elsewhere stay
standard tables and forms.

## Motion

One authored vocabulary, all `cubic-bezier(0.16, 1, 0.3, 1)`: the landing and
auth starfield `twinkle` (wide amplitude, background dust), the constellation
`star-twinkle` (narrow amplitude, stays legible), the auth card's rise-in, and
short hover/press transitions on controls. Nothing is hidden by default.

## Do's and Don'ts

- **Do** keep space colours on the shell and the constellation only; data
  surfaces stay light.
- **Do** use `brand-ink`, not `brand`, for small text or text-bearing fills.
- **Do** keep subject colours exclusive to their subject.
- **Don't** put an eyebrow/kicker label above a heading — the hero h1
  carries the subject list itself.
- **Don't** stack an icon tile above a heading; put the icon inline.
- **Don't** declare discrete font weights for the variable fonts.
- **Don't** fake constellation density in the renderer; richness comes from
  real approved data.

## Documented detector exceptions

Recorded in `.impeccable/config.json` with reasons:

- `low-contrast` on `*.html` — confirmed false positives: the detector samples
  an uncomposited gradient stop on the layered space backgrounds (rendered text
  is white/gold on dark navy), and reports a `#090d1f`-on-`#4c3fd9` pairing
  that does not exist in the live DOM. Real contrast failures found in the same
  pass were fixed, not ignored (`brand-ink`, darker `state-rejected`).
- `dark-glow` on `index.html` only — the gold `.btn--star` shadow reads as a
  glow solely where the button sits directly on the night-sky hero; that glow
  is the product's "star lights up" metaphor.
