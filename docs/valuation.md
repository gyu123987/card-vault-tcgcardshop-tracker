# Collection value and net worth

Collection value uses current saved market prices. Its hover/click breakdown is additive:

- Tetramon, Destiny, Ascension and Ghost: ungraded album copies only. Ghost combines white and black.
- Graded: all owned grades in all tracked locations, including displays.
- Decks: ungraded copies in actual saved game decks. Drafts do not own or reserve copies.
- Storage and displays: all remaining ungraded copies, including held cards, pack openers and grading submissions.

Every card copy appears in exactly one row. These rows are different from the analytics “Value by set” chart, which groups all locations by set.

Net worth is an **estimated asset value**, not a liquidation balance. It adds current money, collection value, merchandise at current saved market prices, owned furniture and decorations, purchased expansions, unlocked product licenses, purchased shop finishes and the scanner unlock. Furniture and permanent unlocks use current game purchase costs; the save does not provide their original purchase receipts. Spent/loaded consumables, customer-held items, pending deliveries and unpaid bills are excluded from this estimate.

The game’s double-precision money field takes precedence over the legacy float. Furniture prices and license/finish tables are retrieved from the local `ShelfData_ScriptableObject` and `StockItemData_ScriptableObject`. Shop B's price comes from its serialized scene component. The scanner's nonserialized $12,000 price comes from `ScannerRestockScreen`'s constructor in the installed game. Expansion prices follow `CPlayerData.GetUnlockShopRoomCost` and `GetUnlockWarehouseRoomCost`, summing zero-based purchase indexes below the saved expansion count.

Boxed fixtures remain owned. Placed and inventory decorations are counted separately. Lifetime upgrade spending is not added, since it includes purchases already counted here and may include sold furniture. Objects with no purchase entry in the game catalog have no assigned purchase value. Unknown future object types or missing prices produce a visible partial-estimate warning.

Existing caches need **Retrieve / refresh assets** once for the economy tables. The Windows launcher detects an older cache and retrieves it when opening. Source users should run their asset-retrieval script and restart the server. Game files and saves are never modified.

Click the net-worth total to expand itemized categories, including quantities, locations, unit prices and totals. Merchandise includes shop shelves, loose boxes, storage-rack boxes, held items, pack openers and workbenches. Storage-rack compartment labels are not stock and are never counted twice.

Merchandise prices follow RestockManager.GetItemMarketPrice: saved generated market price plus its saved daily percentage adjustment, using the game's float arithmetic and rounding to cents. Custom shelf selling prices are ignored. Asset retrieval reads catalog names and purchase costs from the installed game; each save sync reads current prices, quantities, cash and owned unlocks. Missing prices are disclosed rather than guessed.
