# Deck identity, records and inventory

Local drafts preserve exact variant choices. Sync never substitutes variants or transfers a manual W–L record to a merely similar game deck.

| Change | Result |
| --- | --- |
| Rename a game deck without changing its cards | Its existing backup and W–L stay linked. |
| Change cards, variants or quantities in game | The former backup becomes a draft with its W–L. The new game build is unbacked with 0–0 unless it exactly matches another saved draft. |
| Restore the original game build | The matching draft links again, including its W–L. |
| Edit a backed-up game deck in the app | Saving changes updates that local draft and keeps its W–L. The unchanged game build becomes unbacked; importing the edited build and syncing links it again. |
| Duplicate a deck | The new draft starts at 0–0 and has no intended replacement. |
| Record W–L on an unbacked game deck | A local backup is created to retain the record. |

Manual and automatic resync preview mismatches and warn before applying them. Startup reconciliation also preserves detached drafts and explains their status. Names are labels, not identity: matching uses an order-independent signature of exact card IDs and amounts. Identical copies of a build cannot be distinguished reliably by card content, so matching is deterministic and one-to-one. There is no fuzzy merge that might attach a record to an unrelated deck.

## Availability

Drafts are alternative plans, not inventory reservations. Red warnings identify selected variants that lack enough usable copies. Amber warnings identify copies also requested by other drafts. Neither warning changes selections or prevents saving a plan. Graded, displayed, stored, and cards at grading remain owned but are unavailable for direct deck imports.

An intended replacement credits copies from the exact selected live build. This avoids reporting those cards as missing when planning its replacement. Credit expires if that build changes or disappears; reusing its game slot does not grant credit. Different drafts competing for shared copies remain flagged.

Automatic allocation defaults to most quantity, with least-expensive and most-expensive usable alternatives. It uses available ungraded copies, including exact replacement credit, and never chooses an unowned high-value card simply because it is expensive. If there are insufficient copies, remaining amounts are retained as flagged draft placeholders. Manual selection includes zero-owned variants, including Ghost counterparts where present.

## Evolution and preview

Evolution links use the catalog's immediate parent relationships. Builder warnings identify a higher stage without its immediate lower stage; these are advisory because a deck can intentionally omit a stage. Builder-only filters show connected evolution families or their absent members.

Card previews default to variants in the selected set, with options for all sets and Ghost counterparts or PSA grades of the exact variant. Available counts precede owned counts. Location tooltips aggregate counts and omit empty locations. At-grading and staged grading submissions are included in ownership, but not deck availability.

## Verification

48 automated tests cover inventory, exact matching, persistence, manual records, replacement credit, draft conflicts, evolution relationships, allocation strategies, forecasts, and timeline behavior. Browser checks exercised an unsaved test build, missing-evolution and unavailable-variant warnings, grade previews, the six-column desktop gallery, and mobile width. No verification deck or fake W–L record was saved.

## Pending game updates and UI

Edits from a live deck retain its exact replacement signature and original name. Once cards differ, the app shows **Awaiting in-game update / Edited from [name]**, credits copies from the original build, and only reports genuine additional shortages. If that original build is no longer present, the label asks for replacement review instead of silently borrowing another deck's cards. Import the edited build in game and resync to complete the update. Existing independently created drafts can choose an intended replacement explicitly; the app does not infer lineage from similar names.

Shortage counts and shared-copy buttons open location breakdowns instead of hover-only warnings. W–L uses separate green Wins and red Losses fields. The Duplicate button has been removed.

Completion settings now accept any copy or an exact set of conditions (Ungraded and PSA 1–10). Every selected condition is now required. Each missing card-and-condition target gets its own collection row; overall completion counts those same targets. Inventory counts and values are unchanged. Older PSA threshold preferences are migrated to their displayed exact-grade selections.

The installed CardUI prefab's TMP font reference (sharedassets1 file 5, object 566) identifies **FredokaOne-Regular SDF border**, family **Fredoka One**, regular face, with bold style flags on card text. The renderer now uses a locally bundled Fredoka One font from Google Fonts and respects the prefab's bold/italic flags. Web shadows approximate the Unity SDF outline; exact shader rasterization still differs. Font URL: https://fonts.gstatic.com/s/fredokaone/v15/k3kUo8kEI-tA1RRcTZGmTmHB.ttf . Original license included at public/assets/fonts/OFL.txt, from https://github.com/librefonts/FredokaOne .
