---
name: Платформа школьных конкурсов
description: A velvet-and-brass trophy display case for tracking school-contest progress and diplomas.
colors:
  velvet: "#16302a"
  velvet-light: "#203f36"
  velvet-deeper: "#0e221c"
  brass: "#c9a227"
  brass-bright: "#e8c468"
  brass-dim: "rgba(201, 162, 39, 0.38)"
  cream: "#eef0e8"
  cream-deep: "#e1e6d8"
  ink: "#20251f"
  ink-muted: "#52605a"
  border: "#d7dcce"
  danger: "#a3291f"
  danger-bg: "#f7e6e3"
typography:
  display:
    fontFamily: "Forum, Georgia, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: "Forum, Georgia, serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.08em"
    textTransform: "uppercase"
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "12px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "22px"
components:
  button-primary:
    backgroundColor: "{colors.brass-bright}"
    textColor: "{colors.velvet-deeper}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
    typography: "{typography.body}"
  button-ghost:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  card:
    backgroundColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "22px"
  badge:
    rounded: "6px"
    padding: "4px 10px"
    width: "108px"
---

# Design System: Платформа школьных конкурсов

## Overview

**Creative North Star: "The Trophy Display Case"**

A dark-velvet museum vitrine holds the frame — header, navigation, and progress rail — while brass gilding marks everything earned or active. The thesis is explicit in the shipped build: student progress reads as trophies on a shelf, not an abstract percentage bar or a generic grey SaaS dashboard. Working surfaces (tables, forms, participation cards) stay deliberately outside the vitrine: cream and graphite, flat and legible, because the display case is for honors, not for data entry.

The palette was corrected mid-build: a warm-cream default was flagged as the generic AI-cliché palette and replaced with a cooler, deliberately green-and-brass "museum stone" system. The display face was corrected too — Cinzel was the original plan, but it ships with no Cyrillic glyphs and was silently falling back to Georgia for Russian text. Forum replaced it: same engraved-capital, gravure-on-brass character, with real Cyrillic coverage, self-hosted at weight 400 only.

**Key Characteristics:**
- Velvet-green display case (header, nav, trophy shelf) vs. cream-and-white working surfaces — the vitrine never bleeds into data.
- Brass/gold gradient marks earned, active, or current state everywhere; its rarity on any given screen is the point.
- One hand-authored line-icon sprite, no emoji, no icon font — replacing emoji placeholders (🏆/🛠) that existed before this system.
- Forum (display, weight 400 only) over Manrope (body/UI, 500–800), both self-hosted, zero CDN dependency.

## Colors

The palette is two cool, saturated poles — velvet green and brass gold — anchoring a nearly achromatic cream/graphite field for everything that isn't a trophy.

### Primary
- **Brass** (`#c9a227`) and **Brass Bright** (`#e8c468`): the earned/active/current signal. Drives primary buttons, earned trophy fills, the points plaque, winner badges, active nav pill, focus rings. Always as a gradient (`linear-gradient(180deg/145deg, brass-bright, brass)`), never flat.
- **Brass Dim** (`rgba(201, 162, 39, 0.38)`): the same accent desaturated for structure — dashed outlines on unearned trophy slots, hairline shelf armature, dashed drop-zone borders, scrollbar thumb.

### Secondary
- **Velvet** (`#16302a`), **Velvet Light** (`#203f36`), **Velvet Deeper** (`#0e221c`): the display-case material. Navbar, trophy shelf, login background, modal overlay, toast background. Always as a vertical gradient between two of the three steps, never a flat fill.

### Neutral
- **Cream** (`#eef0e8`) / **Cream Deep** (`#e1e6d8`): page background and secondary surface fill (hover rows, hint boxes, file-drop zone).
- **Ink** (`#20251f`) / **Ink Muted** (`#52605a`): body text / secondary text (meta, labels, subtitles).
- **Border** (`#d7dcce`): the one hairline border color for cards, inputs, table rules.
- **Danger** (`#a3291f`) on **Danger Bg** (`#f7e6e3`): destructive actions and error text only.

### Named Rules
**The Vitrine Doesn't Bleed Rule.** Velvet and brass are reserved for the display case (nav, trophy shelf, login shell, badges-as-trophies). Tables, forms, and contest cards stay on cream/white/graphite. A velvet gradient on a data table or form card is drift, not reinforcement.

## Typography

**Display Font:** Forum (with Georgia, serif fallback)
**Body Font:** Manrope (with Segoe UI, sans-serif fallback)

**Character:** Forum is a single-weight engraved capital face — used exactly like lettering stamped into a brass plate, never for body text and never faux-bolded (the CSS comment is explicit: "Forum ships one weight; browser-bold would fake-embolden"). Manrope carries every working-surface weight (500/600/700/800) and never appears in all-caps display roles.

### Hierarchy
- **Display** (400, 17–21px, Forum): `h1`/`h2`/`h3`, navbar brand wordmark, modal titles, level badge, points-plaque value, stat-plaque numeral. Section titles step down to 21px.
- **Label** (400 Forum or 700 Manrope depending on context, 10.5–12px, uppercase, 0.04–0.08em tracking): trophy-slot labels, points-plaque label, stat-plaque caption, field labels, table headers, badges.
- **Body** (500–600, 13–14px, Manrope): paragraph text, nav links, form inputs, table cells.
- **Emphasis** (700–800, 14–15.5px, Manrope): buttons, contest-card titles, navbar-user name.

### Named Rules
**The One-Weight Display Rule.** Forum ships only at 400. Never request bold Forum; let Manrope carry all weight variation.

## Layout

Single-column, container-constrained layout (`max-width: 1120px`, 20px side padding) shared by all three surfaces. The navbar is sticky, full-width, velvet, with a flex-wrap row (brand, links, user). Dashboard content below the navbar is single-column sections (`.section`, 30px vertical rhythm) with an internal grid only for contest cards (`repeat(auto-fill, minmax(260px, 1fr))`, 16px gap) and a flex row for the three stat plaques (`flex: 1 1 150px`, 14px gap, wraps on narrow viewports). One breakpoint, `max-width: 640px`: navbar stacks vertically, trophy-shelf footer stacks, points-plaque drops its min-width, trophy labels shrink to 9px.

## Elevation & Depth

Hybrid: velvet surfaces are rendered with gradient + glow rather than drop shadow (the trophy shelf, navbar, login shell use `--shadow-raised`, a soft diffuse shadow, not a hard offset); cream/white surfaces use a quieter two-layer ambient shadow (`--shadow-card`) for separation, not hierarchy. Shadows never carry a sharp offset — the system has no neobrutalist hard-shadow vocabulary.

### Shadow Vocabulary
- **Card** (`--shadow-card`: `0 1px 2px rgba(22,48,41,.06), 0 8px 20px -10px rgba(22,48,41,.18)`): default lift for white/cream cards (contest cards, stat plaques, modal content at rest).
- **Raised** (`--shadow-raised`: `0 10px 30px -12px rgba(14,34,28,.35)`): navbar, trophy shelf, login card, modal shell, toast — the velvet/featured-surface shadow.
- **Spotlit glow** (`.trophy-slot--current`, `glow-pulse` keyframe, `0 0 0 5px rgba(232,196,104,.28), 0 0 18px rgba(232,196,104,.55)` pulsing to `0 0 0 8px / 0 0 26px`): the current-level trophy only. This is a diegetic device — the display case's own spotlight on the active exhibit — not a generic glow effect, and the one dark-glow instance the detector was told to ignore because the world itself calls for it.

### Named Rules
**The No Hard Offset Rule.** Every shadow in this system is soft and diffuse (negative spread, blurred). A crisp, zero-blur offset shadow is a different world's device (neobrutalism) and has no place here, with the single named exception of the spotlit-trophy glow above, which is light, not a card shadow.

## Shapes

Two radius steps: `--radius-sm` (8px) for small controls (buttons, inputs, badges, file-drop), `--radius` (12px) for cards and the trophy shelf. Pills (`999px`) mark state chips only — nav active link, level badge. The login crest and avatar are full circles. Corners read as a light bevel (brass-frame feel per the direction contract) rather than a sharp or heavily rounded silhouette; no surface in the build uses a hard square corner.

## Components

### Buttons
- **Shape:** 8px radius (`--radius-sm`).
- **Primary:** brass gradient fill (`linear-gradient(180deg, brass-bright, brass)`), velvet-deeper text, inset top highlight + soft brass drop shadow, 10px/18px padding.
- **Hover / Focus:** `filter: brightness(1.06)` on hover, 1px translateY press on active; focus-visible gets a 2px brass outline with 2px offset system-wide.
- **Ghost:** cream fill, ink text, 1px border; on the navbar specifically, ghost swaps to translucent white-on-velvet (`rgba(250,247,240,.08)`) since cream-on-velvet would invert correctly but look like a hole in the case.
- **Danger:** solid `--danger` fill, white text, for destructive admin actions only.

### Badges
- **Style:** fixed minimum width (108px) regardless of label length — status is a plaque, not a tag, so it doesn't reflow the row. Six status variants (upcoming/active/finished/registered/in_progress/completed) in muted tonal pairs; `--winner` alone gets the full brass gradient treatment, the only badge promoted to trophy-grade color.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** white (contest cards, stat plaques) or cream (login card, modal) — never velvet.
- **Shadow Strategy:** `--shadow-card` at rest, `--shadow-raised` + 2px lift on hover for interactive cards (contest cards).
- **Border:** 1px `var(--border)` hairline on every card.
- **Internal Padding:** 16–22px depending on density (stat plaques tighter, cards looser).

### Inputs / Fields
- **Style:** white fill, 1px border, 8px radius, 11–13px padding.
- **Focus:** border shifts to brass, plus a 3px brass-dim glow ring (`box-shadow: 0 0 0 3px var(--brass-dim)`) — the same accent family as the trophy glow, scaled down for form controls.

### Navigation
- Velvet sticky header, Forum-set uppercase brand with a brass trophy icon. Links are pill-shaped; the active tab fills with the brass gradient (velvet-deeper text), inactive links are translucent cream text, hover adds a faint white wash. Mobile: the navbar container wraps to a vertical stack below 640px.

### Trophy Shelf (signature component)
The `.trophy-shelf` is the system's one unmissable move: a velvet card containing `.trophy-shelf__rail`, a flex row of `.trophy-slot` elements rendered by `renderTrophyShelf()` in js/student.js, one per level. Unearned slots are dashed brass-dim circle outlines; earned slots fill solid brass-gradient; the current slot additionally runs the `glow-pulse` animation (2.4s, infinite) — the single spotlit exhibit in the case. Slots stagger in with a `slot-rise` entrance (70ms stagger per index). Beneath the rail, `.trophy-shelf__footer` holds the level-badge pill, an in-level progress bar, and the `.points-plaque` — a brass nameplate mounted flush inside the case (inset highlights only, no outer drop shadow — it reads as bolted to the shelf, not stacked on top of it). A faint repeating brass hairline grid (`repeating-linear-gradient`) sits behind the rail as the shelf's tier armature, with a solid brass edge line (`.trophy-shelf__rail::after`) as the shelf's physical front lip. Below the shelf, three `.stat-plaque` cards (fixed-size, cream-bordered, Forum numerals) report contest/win/diploma counts — kept on white ground, outside the vitrine, per the Vitrine Doesn't Bleed Rule.

## Do's and Don'ts

### Do:
- **Do** gate every velvet-and-brass treatment to the display case: navbar, trophy shelf, login shell, and the brass-gradient "winner"/active states. The rest of the UI stays cream/white/graphite.
- **Do** use the brass gradient (never a flat brass fill) for anything earned, active, current, or primary-actionable.
- **Do** keep Forum at 400 weight only, reserved for display/label roles; keep Manrope for everything a user reads at length.
- **Do** keep shadows soft and diffuse (`--shadow-card` / `--shadow-raised`); the spotlit trophy glow is the one named exception, scoped to the current-level trophy.
- **Do** keep status badges and the points/stat plaques fixed-width so status changes never reflow their row.

### Don't:
- **Don't** introduce a hard-offset, zero-blur shadow anywhere outside the trophy glow exception — this is not a neobrutalist world.
- **Don't** reintroduce emoji icons (🏆, 🛠) or any icon font; all icons are line-stroke SVGs drawn from the single `ICON_SPRITE` in js/common.js.
- **Don't** bold or synthetically weight Forum; request Manrope at a heavier weight instead.
- **Don't** let the velvet/brass vitrine palette leak into tables, forms, or contest-card bodies — those stay on the neutral cream/graphite surface by design.
- **Don't** treat the repeating brass hairline grid behind the trophy rail as a decorative stripe pattern to reuse elsewhere; it is the shelf's own tier armature, scoped to `.trophy-shelf__rail` only (an advisory-only detector finding on this exact use was reviewed and accepted as the literal shelf structure, not cleared for reuse as a general background texture).
