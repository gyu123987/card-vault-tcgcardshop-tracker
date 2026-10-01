# Pack probabilities and saved timelines

Implemented in lib/analytics.mjs and Analytics. Rules inspected in the locally installed Assembly-CSharp.dll on 2026-09-28: SHA256 A25691CEB398C9C0EB4C37780771C2BBBBEFEF04091FDA2F3769E20BCABA65E3. Sources: CardOpeningSequence.GetPackContent, GetGodPackRollIndex, GetPackContentCardDataList and the normal OpenScreen branch. Raw audits are in .tools/pack-odds-audit.txt and .tools/manual-pack-audit.txt.

## Normal cards
Seven-card packs roll foil independently at 5%. Edition rolls stop at the first success: Full Art 0.25%, EX 1%, Gold 4%, Silver 8%, First Edition 20%, otherwise Base. Actual EX probability is 0.9975 x 0.01; subsequent editions likewise multiply by every prior failure probability. Multiply each marginal by 0.05 or 0.95 for finish. Ascension names these slots Base, Silver, Gold, Silver Full Art, EX Full Art and borderless Full Art.

The normal-card column excludes special packs and is before Ghost replacement. The 12 outcomes sum to one. Monster pools and rarity change by pack tier; these probabilities are across all names, not a specific named card.

## Special packs and Ghost
GetGodPackRollIndex samples an integer in [0,100000). Exact counts by returned index 0..13:
98112, 501, 311, 251, 201, 71, 121, 100, 49, 21, 9, 51, 1, 201.

Index 0 is normal. 1..5 force First Edition through Full Art non-foil; 6..10 force those editions with foil. 11 forces all-Ghost non-foil, 12 all-Ghost foil, 13 Base foil. Overlapping roll 1130 belongs to index 8 because its branch occurs first. Special packs total 1.888%, including 0.052% all-Ghost and 0.001% all-Ghost foil.

Non-Ghost-special packs roll a final-slot Ghost replacement: g=20/20000 for Tetramon or 20/10000 for Destiny/Ascension. Ghost specials replace all seven. Each Ghost chooses White/Black at 50%. Foil follows normal or forced pack rules, not always 5%.

With w0=0.98112 and p the normal-card edition/finish marginal, at least one main-set target variant per pack:
w0 * [(1-g)*(1-(1-p)^7) + g*(1-(1-p)^6)] + weight of matching forced-edition pack.
No special pack forces Base non-foil. All-Ghost packs contribute zero main-set cards. Per-pack outcomes overlap and do not sum to one.

Any Ghost: 0.00052 + 0.99948*g (0.151948% Tetramon, 0.251896% Destiny/Ascension).
Any Ghost foil: 0.00001 + g*(w0*0.05 + 0.00501).
A specific Ghost color/finish: half its single-Ghost contribution plus its all-Ghost special weight times (1-0.5^7).

Shop level 1 disables Ghost and special rolls. The first tutorial pack can force a foil and is excluded. Assumes unmodified installed rules and normal seven-card openings; game updates/mods can change them. The OpenScreen bulk preview branch assembles multiple packs without the normal replacement path and is outside this model.

## Saved timelines
LightManager.EvaluateTimeClock confirms m_LightTimeData.m_TimeHour is 24-hour time, clamped at 21:00, with m_TimeMin as its minute. New snapshots store gameMinute. Day + gameMinute/1440 determines horizontal position. Skipped days occupy space; connecting lines are not measured intermediate values. Hover/focus shows game day/time and value.

All stored observations are now retained, including untimed same-day points and equal-minute points. Untimed observations sit at their game-day marker without inventing a clock. Equal positions can overlap; keyboard arrows and the observation table expose every record. Manual resync always appends a snapshot, even for an unchanged save. Automatic checks still deduplicate unchanged observations; there is no longer a 1000-record truncation. Past records already discarded by an older version cannot be reconstructed.

The default viewport targets about one point per 26 CSS pixels (8 to 30 observations) and avoids a large preceding gap that would compress a recent cluster. Coincident boundary observations stay together. Dragging selects a game-time range, double-click/Show all resets to all observations, and Recent restores the adaptive window. One-point ranges are padded by half a minute on each side. Only sync charts zoom; fixed daily market/report charts do not.

## Player forecasts

The installed MonsterData settings have openPackCanUseRarity=true and openPackCanHaveDuplicate=false for Tetramon/Destiny. GetPackContent sets a seven-card quota for the selected rarity. Ascension and Ghost have rarity selection disabled and duplicates enabled; monster selection is uniform over their shown pools. Catalog pools contain 121 main-set species and 20 Ghost species. These settings were checked in .tools/monsters.json.

The forecast uses the current completion target to identify missing edition/foil variants. Tetramon/Destiny assume a fixed equal 25% mix of Common, Rare, Epic and Legendary packs, including after a tier is complete. Ascension uses its own packs. Each Ghost color is a separate goal, using the selected hunting set. Main-set completion excludes Ghost. These rows are not additive because Ghost is obtained while opening other sets.

For next-new probability, group missing variants by monster. In a normal pack, the miss probability for each monster is one minus the sum of the mutually exclusive missing edition/finish probabilities. For draws with replacement, the pack miss probability is the mean miss probability raised to the draw count. For distinct draws, use the normalized elementary symmetric polynomial of those per-monster miss probabilities (computed by dynamic programming). Mix six/seven main-card cases and all special-pack outcomes. Ghost single replacement and seven-card special branches use their own color/finish union probabilities. This calculates a union, not a sum that double-counts multiple new cards. Average packs to the next new variant is 1 / pack hit probability.

Full-set completion is an explicitly labeled approximation. Each missing named variant has a per-pack hit probability p. Approximate the maximum of independent geometric waiting times using rates -log(1-p), numerically integrate 1 minus the product of their CDFs, and apply a half-step discretization correction. A single remaining target returns exactly 1/p. This captures the long wait for rare remaining variants but approximates correlations from multiple cards arriving in one pack, especially special packs. No confidence interval or guarantee is claimed. Assumes fixed independent pack-opening strategy, no purchases/trading, and no grading. PSA targets cannot be completed by packs and show a grading-required state, not a finite pack forecast.

The calculation details include the normal general odds table, grouped by finish. The normal-card column is explicitly conditional on ordinary packs before Ghost replacement. The pack column includes forced specials and Ghost replacement. A Ghost replacement swaps the seventh card rather than adding an eighth.

## Value chart animation

The graded-value checkbox changes this chart's totals, percentages and legend only. Both shapes share a 64-point SVG polygon representation so toggling grades and switching bars/pie interpolate continuously. Reduced-motion preferences skip animation. Other collection totals remain unchanged.
