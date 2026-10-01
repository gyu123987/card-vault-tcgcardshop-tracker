# Setup and data reference

[Back to Card Vault](../README.md)

## Data and accuracy

`data/catalog.json` and `public/assets/` are extracted from the installed game, not downloaded card art. This installation yielded 6,872 collectible variants and 435 artwork, frame, mask, icon and material assets. Main Tetramon, Destiny, Ascension and both Ghost backgrounds contain 4,436 variants. Additional game catalog sets are accessible with the set filter.

The catalog reflects the installed Unity 2021.3.38f1 game assembly at extraction time. Six borders plus foil make twelve variants per standard card; Ghost uses a separate two-variant indexing scheme per background. Card page means the card's position in its set, grouping its variants; it is not a live sorted binder page.

Ownership combines album, saved decks, display/combination shelves (including projectors, card display tables and tournament prize shelves), storage, donation boxes, unclaimed pack-opener cards, held cards, supported card boxes, and cards submitted for grading. All 14 installed card-display furniture types are supported through the shared `CardShelfSaveData` and `CardItemCombiShelfSaveData` records, including absent and boxed fixtures. Unknown future display type IDs in these records are counted with a fallback label. Analytics lists each supported type and current counts. Play tables contain accessory settings, not additional collectible cards. Only album copies are offered as immediately available in deck building. Graded copies are included in total ownership and value, with PSA 1–10 selectable in card details. The Graded collection filter shows existing graded holdings; selected completion conditions can add missing PSA target rows, without duplicating owned value. Drafts are independent plans and do not reserve cards against other drafts.

Graded values use the generated grading multiplier indexed by card and grade, plus the game’s grade bonus. Prize metadata mirrors shelf cards and is not counted again. Collection value history is versioned to avoid mixing old ungraded-only totals with new totals.

Prices reproduce the game's generated base price plus current percentage adjustment. Price-history observations use that same base and the save's historical modifiers, matching the game's pricing structure. Shop report order follows the save. Collection snapshots begin when this app is used; no historical ownership is fabricated.

Artwork, frames, masks, elemental icons and layout transforms are extracted from the game prefab. Trimmed sprites are restored to their original canvases before composition. Browser text and foil lighting approximate Unity’s font/shader output; they are not pixel-perfect. Game deck export grammar was inspected from `PlayCardGameManager.CopyDeckDataToClipboard` and its import parser. Automated tests validate the grammar; manual in-game import has not yet been verified. The game may substitute unavailable variants. Exact variant matching intentionally keeps such a deck distinct from the original draft.

Drafts and snapshots persist in `data/drafts.json` and `data/snapshots.json`. Drafts are scoped to save filenames; use the same slot for subsequent syncs. Back up this directory to preserve them. Cover choices persist in `data/deck-covers.json`, keyed by save profile and exact deck composition, so renames and game/local-backup views keep the same preview. Identical deck compositions share a cover. Cover changes never create backups or change the game save. Private saves, extracted assets, development tools and app data are git-ignored.

## Setup on another Windows PC / refresh game assets

Install Node.js 20+ and Python 3.12 (including the `py` launcher). Keep a local installation of TCG Card Shop Simulator. Double-click **Start Card Vault.cmd**: if the asset cache is absent, it runs the retrieval workflow first. This installs the pinned Python extraction dependencies from PyPI into a private `.tools/asset-env` environment. Internet access is only needed to install those tools; game images are read from disk.

Use **Retrieve Game Assets.cmd** to rebuild the cache after a game update. It detects Steam through the current user's registry and `libraryfolders.vdf`, including libraries on other drives. If detection fails, it asks for the folder containing `Card Shop Simulator_Data`. You can also use:

```powershell
.\Retrieve-GameAssets.ps1 -GameDirectory "D:\SteamLibrary\steamapps\common\TCG Card Shop Simulator"
```

Or set `TCG_GAME_DIR` to that folder before running retrieval. Each extraction is staged and validated before publishing the resulting catalog and image files. Extraction failures leave the working cache intact. The game and its saves are read-only. Retrieval never changes drafts, history or cover choices. Restart a running Card Vault server after retrieval so its in-memory catalog is refreshed.

Save discovery uses the current Windows user's home folder, not the original developer's username. For nonstandard save locations, set `TCG_SAVE_DIR` before starting the app. `TCG_DATA_DIR` is an advanced server/test override; the desktop retrieval workflow writes the standard project-local `data/catalog.json`. Extraction currently targets the inspected Unity/game format; future game updates may require an extractor update. Windows is the supported setup path; Steam Deck/macOS are not tested.

## Sharing the source

Share source through Git, not a ZIP of the working directory. `.gitignore` excludes `data/`, `public/assets/`, `.tools/`, local environment files and `docs/*.png` screenshots that contain game art or personal statistics. Each recipient retrieves assets from their own installed game. The explicitly supplied feature-tour screenshots in `docs/screenshots/` are a documentation exception; extracted asset caches remain excluded. The small open-license Fredoka One UI font is kept separately in `public/fonts/` with its OFL license; see [third-party notices](../THIRD_PARTY_NOTICES.md).

Before publishing, inspect `git status --short` and `git ls-files`. Ignoring a path does not remove files already committed in an existing repository. This project is intentionally unlicensed at present. Public source visibility does not grant a general reuse license; dependency licenses remain in effect. No repository publication is performed by the setup scripts.

## Local storage footprint

- Extracted images/layout cache: about 54 MiB for the inspected game build; generated once, not once per sync.
- Catalog: about 4.3 MiB, generated once.
- Sync history: small summary records only (`valuationVersion`, save filename, change hash, game day/minute, sync timestamp, duel wins, collection value and copy count). No raw save backup, card images or per-card inventory is stored per sync. The inspected history contains 14 records in 3,102 bytes, about 222 bytes per sync; 10,000 similar entries are roughly 2–3 MB. History is retained without a hard cap.
- Drafts, manual W/L records and cover selections: small separate JSON files. The server reads current card price histories from the game save into memory; it does not duplicate those histories into each snapshot.

Automatic sync deduplicates unchanged state at the same in-game time. Explicit recorded syncs are retained, including multiple points on one day. Back up `data/drafts.json`, `data/deck-covers.json` and `data/snapshots.json` to preserve personal app data; catalog and assets can be regenerated.

## Verify

Run `npm test`. Setup discovery tests run with `py -3.12 -m unittest discover -s tests -p test_asset_setup.py`. Tests cover count reconciliation, ghost-background separation, graded valuation and tournament deduplication, cross-variant deck limits, cheapest-copy allocation, deck-code grammar and sync state transitions. Browser checks cover collection filtering/details, database browsing, deck editing/variants, cover ordering, persistence and responsive layouts. Metadata stress checks use the longest catalog name, long variant names, five-digit counts and large currency totals at 320, 375, 768 and 1440 pixel widths.

## Build the portable Windows package

Run `powershell -ExecutionPolicy Bypass -File desktop/Build-Windows.ps1` on Windows with Python 3.12 and pip available. `-PythonCommand` can name a Python 3.12 executable instead of the `py` launcher. The build downloads pinned official Node/Python archives and installs the extraction requirements from PyPI. Node SHA-256 is checked against its release manifest; Python's archive checksum is checked against its release page. Runtime/dependency licenses are kept in the package. Build output is git-ignored under `dist/`; distribute the ZIP as a release artifact rather than committing binaries. Move the previous `dist/CardVault-Windows` folder aside before rebuilding.

The release includes only an explicit allowlist of app files, tools and the open font. It excludes `data/`, extracted `public/assets/`, screenshots and development tools. End users retrieve game assets locally. The bundled runtime is tested here, but a separate clean Windows machine remains part of release testing. The launcher checks public GitHub Releases at startup and offers a download button for a newer version. It does not require an account, upload save data or install updates silently. The EXE is unsigned.

Pack-opening forecasts now separate Common, Rare, Epic and Legendary packs for Tetramon and Destiny. Each row estimates completion of that rarity pool by opening only that pack; it does not estimate an impossible whole-set completion from one tier. Ascension uses its all-rarity pool, and Ghost remains a separate goal. Database/deck searches include Basic stage, Has evolution line and Has no evolution line chips; deck searches additionally support missing members of the current deck's evolution lines. The deck gallery can collapse cosmetics to a count per identity, displaying the highest-priced variant actually selected while preserving the true summed value.

Collection browsing now supports removable multi-select filter chips (OR within a category, AND across categories), separate edition and foil filters, elemental types, strongest-stat sorting, and grading/regrading value sorts. Card details include Ghost counterparts, owned condition totals, expected grading values with probability breakdowns, and interactive market charts. Analytics includes display inventory, completion percentages, set value bars/pie, saved pack-opening reports, and price movers. See [grading and analytics methodology](grading-and-analytics.md) for recovered odds, fees, and limitations.

Analytics also includes game-day timelines with saved in-game times, plus edition/foil and Ghost odds recovered from the installed pack generator. See [pack probabilities and timeline rules](pack-estimates.md) for formulas and assumptions. Tests cover all special-pack roll boundaries, Ghost replacement, saved clock validation, irregular history spacing and same-minute snapshot deduplication.

Collection and database grids keep four columns on desktop (fewer on smaller screens) and 36 entries per page. Only the deck viewer expands to five columns. Card details opened from that viewer use a second dialog, preserving the original deck and its scroll position. The Available / owned statistic exposes a hover/focus/click popover for the exact selected variant and condition, separating inventory copies from copies in other locations. Collection ownership badges and variant-table counts remain plain.


Pack forecasts for graded completion targets estimate **candidate copies**, not PSA success: PSA 10 + PSA 9 + Ungraded means three copies per variant, less all copies already owned. Grading success, retries and costs are excluded. Collection completion itself still requires the exact selected conditions.

Collection tags can be clicked to add filters. The Owned > threshold applies to the displayed ungraded or individual PSA row. Informational popovers and filter menus flip/shift within the viewport and scroll internally when needed.
