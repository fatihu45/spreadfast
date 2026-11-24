# Studio design refresh — 13 November 2026

Branch: `feat/spreadfast-studios`. No merge to main or deployment.

## Experience changes

- Replaced the five cramped cards with an editorial collection: two lead cards, three supporting cards, responsive tablet arrangement and a single-column phone layout.
- Seven newly generated photographic assets replace old studio illustrations and Auto Studio's emoji. Compressed 1200 × 800 WebP imagery totals approximately 440 KB. Asset directions and locations are documented in `client/src/components/LandingHeroVisual.asset.md`.
- Retained SpreadFast's logo, green primary and existing design tokens. Refined system typography, whitespace, borders, rounded surfaces, focus states and reduced-motion behavior.
- Redesigned Fashion, Auto and Product introductions and presentation selectors. Added numbered upload/customization steps, larger inputs, removable photo previews, informative empty previews, visible credit costs and an insufficient-credit explanation.
- Refined Quick Ad and Commercial panels; new photographic empty previews and Quick Ad style thumbnails. Phone inputs use 16px text and controls have larger touch targets. Commercial's phone form now comes before the preview.
- Updated the landing hero, studio collection and mannequin image. Existing actual video demonstrations and their matching input photo remain, preserving the factual before/after example.
- Catalog request failures no longer incorrectly label every new studio as coming soon. Failed credit loading has a useful fallback link. Upload cancellation keeps the existing selection; resetting the file input permits selecting the same image again after removal.
- Unsupported studio URLs return a link to the studio collection. Unknown credit balances cannot enable generation. Existing generation/payment services and server-owned credit prices are unchanged.

## Validation

- Frontend: 26 suites, 224 tests passed, including catalog failure behavior and upload/remove/credit-button behavior.
- Production build and SEO generation passed using the repository's existing `CI=false` build setting.
- Existing hook dependency warnings in AuthContext, QuickAd and AICommercials remain; the strict CI=true build treats them as errors.
- Targeted ESLint for Studios, StudioWorkspace, their tests and LandingHeroVisual; whitespace check.
- Generated assets inspected and file references verified.
- Browser visual verification is outstanding: local Chromium cannot create its required socket in the execution environment; the cloud browser cannot reach localhost. No desktop/mobile screenshot verification is claimed. Feature branch previews were already disabled in vercel.json and remain disabled.
- No live paid generation or production account testing performed.
