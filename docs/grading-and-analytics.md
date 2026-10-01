# Grading estimates and analytics

The probabilities were recovered from the installed Assembly-CSharp.dll, in RestockManager.OnDayStarted. They are not an even distribution.

| Result | Probability |
| --- | ---: |
| PSA 1 | 0.30% |
| PSA 2 | 0.30% |
| PSA 3 | 0.60% |
| PSA 4 | 1.20% |
| PSA 5 | 5.92% |
| PSA 6 | 4.32% |
| PSA 7 | 8.64% |
| PSA 8 | 17.28% |
| PSA 9 | 23.04% |
| PSA 10 | 38.40% |

Fresh grading uses a 96% high-grade branch and fresh random rolls at each nested condition. Regrading uses one integer roll from 0 through 99: below 30 increases the grade; above 70 decreases it; otherwise it stays the same. That gives 30% up, 29% down, 41% unchanged. Grades are clamped to 1–10, merging the boundary probabilities.

MonsterData services: Value $10 / 12 days, Standard $40 / 7 days, Express $200 / 4 days, Premium $1,500 / 2 days. GradedCardSubmitSelectScreen.EvaluateTotalCost adds $10 delivery per submission, up to eight cards. Service choice does not change the recovered outcome probabilities.

Expected market value is the sum of probability times each resulting PSA price. Net gain subtracts the selected service fee, an equal share of delivery, and the card's current market value. Ranking uses a fixed reference fee: Value service with eight cards sharing delivery ($11.25 per card). The service picker has been removed because the same fee applies to every candidate. These are current-price estimates, not guaranteed profits at completion. Missing grade multipliers produce an unavailable estimate.

Collection sorting can rank expected gross graded value or net grading gain, including already graded copies. Owned ungraded album copies, graded inventory copies, and matching copies on display are eligible. Displayed copies must be retrieved before submitting; cards already at grading are not eligible. The duplicate option preserves one copy of the exact variant and condition across all locations; singleton mode excludes conditions owned more than once. Drafts do not reserve inventory.

Display analytics include physical cards in supported display save records and exclude sale shelves (object type 10) and storage shelves (50). Boxed display furniture still counts. Collection totals continue to include both sale and storage inventory.

Completion counts collectible variants once regardless of quantity or PSA grade. Set details break completion down by rarity / pack tier. Market movers compare the first and latest saved price per owned condition, not changes in inventory quantity. Pack opening counts come from saved game reports; the lifetime total is shown in the top metrics, and the chart shows daily counts including the current report. The save has no complete per-pack outcome log, so opening luck is not inferred from ownership. A next-new-card forecast also needs verified pack-specific drop rates; this is not estimated.

Search text and filter choices are kept only in memory. Inputs disable browser autocomplete; no query history is stored by Card Vault.


## Edition filters and identity browsing

Six filter slots are shared across the three main packs, with finish (foil / non-foil) independent. Each selection matches one edition per main set, not all Ascension artwork containing the words “Full Art”. The menu shows Ascension aliases explicitly:

| Filter | Tetramon / Destiny | Ascension |
| --- | --- | --- |
| Base | Base | Base |
| First Edition | First Edition | Silver |
| Silver | Silver | Gold |
| Gold | Gold | Silver Full Art |
| EX | EX | EX Full Art |
| Full Art | Full Art | Borderless Full Art |

Ghost is selected by its set and finish; it is not one of the six main-pack edition slots. The collection retains exact edition names on the card tags.

The database and deck picker group all sets and variants by card identity. A shared, locally saved artwork preference (Tetramon, Destiny or Ascension) controls representative art there and in the deck builder sidebar. Ghost sets are excluded from representative artwork preferences. It never changes deck allocations. Their filters are gameplay element, effect keywords (Discard, Draw, Boost, Freeze, Search, Shuffle, Evolve, Guardian, Tamer Shield, Destroy, Return, Look at deck), and numeric elemental comparisons, including typed suggestions such as `Fire > 10` or `Water >= 12`. Collection filters additionally support set, edition, rarity, finish, and duplicate/single copies. Multiple comparisons are ANDed; element selections are ORed.

## Duel history limitations

Installed game code `PlayTableGame.ReportWinner` increments both global report win counters, but deck save records contain no result counters. `GameReportDataCollect.CopyData` and `ResetData` omit `duelWinCount`: historical reports therefore do not reliably preserve daily wins, and the current report is not a reliable daily total. Losses only increment runtime PlayTableGame enemy-win fields, not persisted save counters.

Card Vault now stores the lifetime win counter in each relevant sync snapshot. Changes in wins create snapshots even if collection value and inventory are unchanged. The chart displays these observed lifetime totals. A table groups increases observed within the same day and explicitly retains multi-day intervals when syncs span days; neither those intervals nor the baseline are fabricated into daily W–L totals. Counter decreases are marked as resets. Old snapshots without a duel counter are excluded, not treated as zero.


## Separate conditions and completion targets

Collection rows now separate ungraded copies and each owned PSA grade. Quantities and values refer only to that condition; summing rows preserves the overall inventory count and value. Clicking a PSA row opens its specific grade. Condition and exact PSA-grade filters are available, including search suggestions and direct queries such as `PSA9`.

The persistent Completion selector beside Sync controls missing status and all collection/analytics completion percentages:

- Any copy (default): an ungraded copy or any owned PSA grade completes the collectible variant. An empty ungraded row with a graded counterpart says “Graded version owned”.
- Ungraded only: graded copies do not satisfy the completion target; empty ungraded rows are missing.
- PSA N+ only: at least one copy graded N or higher satisfies that variant. Each missing target gets a single zero-quantity placeholder at the threshold grade. Higher owned grades satisfy the target without creating missing entries for lower grades.

Owned PSA rows are never fabricated. Target placeholders have zero quantity/value and are excluded from regrading rankings. The missing filter returns the relevant missing condition/target once per variant. Inventory and value totals always retain all actual copies; changing a completion target only changes completion, not ownership. “Never collected” was removed because historical PSA ownership is unavailable.

Sorting supports both directions within the same dropdown, in this order: card number, name, total value, individual value, expected grading gain, quantity, strongest stat. Expected gross graded value remains in the preview, but is no longer a sort option. Both sync-history charts occupy the bottom analytics row.
