A collection of suggested improvements and feature ideas for Wormhole. These are *suggestions*, not a roadmap or commitment list.

## Adopted

Items from Improvements or Features that have been accepted and implemented. Each entry notes what it originally was and what it became.

- **Overview stats bar** (was Improvement: "Overview tab is informationally empty" + Feature: "World stats dashboard") — Character count and document count now display in the Overview toolbar. The "no world stats, no at-a-glance numbers" part is resolved.
- **"Mentioned In" cross-reference** (was Improvement) — Already implemented via the `LinkedRecords` component on character details. Bidirectional query across `entity_links` shows both character-to-character and character-to-lore links, grouped by type with counts.
- **Character ribbon with faction icon** (was Improvement: "cards lack richness") — Ribbon now supports an optional faction/house/clan icon uploaded as an asset. When set, the ribbon becomes taller (20px) with the icon crest on the left and color bar continuing right. Pills and quote were dismissed as too noisy.
- **Lore Archive word count + folder document counts** (was Improvement) — Live word/character count footer in the document editor. Folder tree badges now show document-only counts (not mixed docs+subfolders).
- **Unified search / command palette** (was Improvement: "search is fragmented" + Feature: "full-text content search") — Ctrl+K opens a global search overlay from any tab (Overview, Characters, Lore). Backend now searches across character names, summaries, intros, detail sections, and lore document titles + content. Results show match origin ("in content" for body matches).

## Improvements

_None pending._

## Features

- Live2D / animated character portraits — support looping videos, animated images (GIFs/APNG), and eventually live2D-style motion portraits in Showcase mode, similar to gacha game character displays
- Per-character particle effects in Showcase — a preset library of ambient particle effects (embers, sparkles, motes, petals, void dust, etc.) that the user can assign per character, so each character's Showcase feels distinct and expressive

## Dismissed

Items moved here from Improvements or Features that were considered but not adopted. Each has a reason.

- **Character flip cinematic quality** — N/A: the 3D card flip was replaced with a fade transition between card front and details back; there's no rotation to enhance
- **"Mentioned in" cross-reference** — Already implemented via `LinkedRecords`; moved to Adopted
- **Recent activity feed on Overview** — Unclear use-case for a single-user app; the user questioned its value. Dropped from scope
- **Overview total word count** — Not needed; character and document counts are sufficient for a single-user worldbuilding app
- **Card tag pills and in-character quote** — Too noisy on the card face; clutters the clean look of the Astral Scriptorium design
