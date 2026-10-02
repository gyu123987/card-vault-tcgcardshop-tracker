const cents = value => Math.round((Number.isFinite(value) ? value : 0) * 100);
const count = value => Number.isInteger(value) && value > 0 ? value : 0;

// Mutually exclusive buckets: graded copies take precedence over their location.
export function collectionValuation(cards) {
 const rows = [{label:'Tetramon · album',value:0},{label:'Destiny · album',value:0},
  {label:'Ascension · album',value:0},{label:'Ghost · album',value:0},
  {label:'Graded · all locations',value:0},{label:'In-game decks · ungraded',value:0},
  {label:'Storage & displays · ungraded',value:0}];
 for(const c of cards.filter(c=>[0,1,2,7].includes(c.expansion))){
  const index={0:0,1:1,7:2,2:3}[c.expansion],unit=cents(c.price);
  rows[index].value += count(c.available)*unit;
  rows[4].value += cents(c.gradedValue);
  rows[5].value += count(c.inDeck)*unit;
  rows[6].value += cents(c.value)-count(c.available)*unit-cents(c.gradedValue)-count(c.inDeck)*unit;
 }
 return {total:rows.reduce((n,r)=>n+r.value,0)/100,rows:rows.map(r=>({...r,value:r.value/100}))};
}

// Installed game: CPlayerData.GetUnlockShopRoomCost / GetUnlockWarehouseRoomCost.
export function expansionCost(index,warehouse=false){
 if(warehouse)return 1000+(500+Math.floor(index/2)*200)*(index>7?1.5:1)*index;
 return 300+(100+Math.floor(index/4)*50)*(index>24?2:index>19?1.5:1)*index;
}

// RestockManager.GetItemMarketPrice: float arithmetic, then Unity RoundToInt
// (ties to even). Use the market value, never the player's custom shelf price.
export function itemMarketPrice(save,type){
 const base=save.m_GeneratedMarketPriceList?.[type],percent=save.m_ItemPricePercentChangeList?.[type];
 if(!Number.isFinite(base)||!Number.isFinite(percent))return null;
 const f=Math.fround,scaled=f(f(f(base)+f(f(base)*f(f(percent)/100)))*100);
 const lower=Math.floor(scaled),fraction=scaled-lower;
 return (fraction===.5?lower+(lower%2):Math.round(scaled))/100;
}

export function merchandiseValuation(save,economy){
 const holdings=new Map();
 function add(type,amount,location){
  if(!Number.isInteger(type)||type<0||!count(amount))return;
  const key=type+'|'+location,old=holdings.get(key);
  if(old)old.amount+=amount;else holdings.set(key,{type,amount,location});
 }
 for(const key of ['m_ShelfSaveDataList','m_CardItemCombiShelfSaveDataList'])
  for(const shelf of save[key]||[])for(const entry of shelf.itemTypeAmountList||[])
   add(entry.itemType,entry.amount,shelf.isBoxed?'Boxed shelves':'Shop shelves');
 // Warehouse shelf compartmentItemType is a label; its stock is represented by
 // stored package boxes. Counting both would double-count warehouse inventory.
 for(const box of save.m_PackageBoxItemSaveDataList||[])
  add(box.itemTypeAmount?.itemType,box.itemTypeAmount?.amount,box.isStored?'Storage racks':'Loose boxes');
 for(const type of save.m_HoldItemTypeList||[])add(type,1,'Held items');
 for(const [key,location] of [['m_AutoPackOpenerSaveDataList','Pack openers'],['m_WorkbenchSaveDataList','Workbenches']])
  for(const fixture of save[key]||[])for(const type of fixture.itemTypeList||[])add(type,1,location);
 const entries=[...holdings.values()].map(h=>{
  const unitPrice=itemMarketPrice(save,h.type);
  return {...h,name:economy?.items?.[h.type]?.name||`Item #${h.type}`,unitPrice,
   value:unitPrice==null?null:cents(unitPrice)*h.amount/100};
 }).sort((a,b)=>a.name.localeCompare(b.name)||a.location.localeCompare(b.location));
 return {entries,total:entries.reduce((n,e)=>n+cents(e.value),0)/100,
  unknown:entries.filter(e=>e.unitPrice==null).reduce((n,e)=>n+e.amount,0)};
}

export function netWorth(save,cards,economy){
 const collection=collectionValuation(cards),warnings=[],rows=[];
 const add=(label,value,note,entries=[])=>rows.push({label,value:value==null?null:cents(value)/100,note,entries});
 const cash=Number.isFinite(save.m_CoinAmountDouble)?save.m_CoinAmountDouble:save.m_CoinAmount;
 add('Current money',Number.isFinite(cash)?cash:null,'Cash balance in the selected save.',[{name:'Cash balance',amount:1,value:cash}]);
 add('Collection value',collection.total,'Each copy belongs to exactly one group.',collection.rows.map(r=>({name:r.label,value:r.value})));
 const merchandise=merchandiseValuation(save,economy);
 add('Merchandise · market value',merchandise.total,'Unopened items on shelves, in boxes/storage racks, held, in pack openers and on workbenches. Unit values use current saved market prices.',merchandise.entries);
 if(merchandise.unknown)warnings.push(`${merchandise.unknown} merchandise units have no saved market price and are excluded.`);
 if(economy&&!economy.items)warnings.push('Refresh assets to retrieve item names for the merchandise breakdown.');
 if(!economy){
  for(const label of ['Furniture & decorations','Shop expansions','Unlocked licenses','Shop finishes & scanner'])add(label,null);
  warnings.push('Retrieve / refresh assets in the launcher to include furniture and unlock values.');
 }else{
  let furniture=0,fixtures=0,unknown=0;const furnitureEntries=new Map();
  const recordFurniture=(name,amount,price,location)=>{
   const key=name+'|'+location,old=furnitureEntries.get(key);
   if(old){old.amount+=amount;old.value=price==null?null:cents(price)*old.amount/100;}
   else furnitureEntries.set(key,{name,amount,unitPrice:price,location,value:price==null?null:cents(price)*amount/100});
  };
  // Each family contains distinct instances, including boxed furniture. Ignore
  // nested records and package contents so furniture/card stock are not duplicated.
  for(const [key,records] of Object.entries(save)){
   if(!key.endsWith('SaveDataList')||!Array.isArray(records))continue;
   for(const item of records){
    if(!Object.hasOwn(item,'objectType'))continue;
    fixtures++;
    const data=economy.furniture?.[item.objectType];
    if(data){furniture+=cents(data.price);recordFurniture(data.name||`Furniture #${item.objectType}`,1,data.price,item.isBoxed?'Boxed':'Placed');}
    else if(!(economy.nonPurchasableTypes||[]).includes(item.objectType)){unknown++;recordFurniture(`Unknown furniture #${item.objectType}`,1,null,item.isBoxed?'Boxed':'Placed');}
   }
  }
  for(const item of save.m_DecoObjectSaveDataList||[]){
   const data=economy.decorations?.[item.decoObjectType];
   if(data){furniture+=cents(data.price);recordFurniture(data.name||`Decoration #${item.decoObjectType}`,1,data.price,'Placed decoration');}else unknown++;
  }
  (save.m_DecorationInventoryList||[]).forEach((n,i)=>{
   if(!count(n))return;
   const data=economy.decorations?.[i];
   if(data){furniture+=count(n)*cents(data.price);recordFurniture(data.name||`Decoration #${i}`,count(n),data.price,'Decoration inventory');}else unknown+=count(n);
  });
  add('Furniture & decorations',furniture/100,`${fixtures} fixtures; placed, boxed and stored decorations at catalog purchase cost.`,[...furnitureEntries.values()].sort((a,b)=>a.name.localeCompare(b.name)));
  if(unknown)warnings.push(`${unknown} furniture/decoration copies have no known purchase price and are excluded.`);
  const rooms=count(save.m_UnlockRoomCount),warehouse=count(save.m_UnlockWarehouseRoomCount);
  let expansion=0;const expansionEntries=[];
  for(let i=0;i<rooms;i++){const value=expansionCost(i);expansion+=value;expansionEntries.push({name:`Shop A expansion ${i+1}`,amount:1,unitPrice:value,value});}
  for(let i=0;i<warehouse;i++){const value=expansionCost(i,true);expansion+=value;expansionEntries.push({name:`Shop B expansion ${i+1}`,amount:1,unitPrice:value,value});}
  if(save.m_IsWarehouseRoomUnlocked){
   if(Number.isFinite(economy.shopBPrice)){expansion+=economy.shopBPrice;expansionEntries.unshift({name:'Shop B unlock',amount:1,unitPrice:economy.shopBPrice,value:economy.shopBPrice});}
   else warnings.push('Shop B unlock price is unavailable and excluded.');
  }
  add('Shop expansions',expansion,`${rooms} shop expansions · ${warehouse} Shop B expansions${save.m_IsWarehouseRoomUnlocked?' · Shop B unlocked':''}.`,expansionEntries);
  let licenses=0,licenseCount=0;const licenseEntries=[];
  (save.m_IsItemLicenseUnlocked||[]).forEach((unlocked,i)=>{
   if(!unlocked)return;
   const entry=economy.licenses?.[i];
   if(entry){licenses+=cents(entry.price);if(entry.price>0)licenseCount++;licenseEntries.push({name:entry.name||`License #${i}`,amount:1,unitPrice:entry.price,value:entry.price});}
   else warnings.push(`Unlocked license ${i} has no known price and is excluded.`);
  });
  add('Unlocked licenses',licenses/100,`${licenseCount} paid product licenses; free licenses add no value.`,licenseEntries);
  let finishes=0;const finishEntries=[];
  for(const kind of ['Wall','Floor','Ceiling']){
   (save['m_UnlockedDeco'+kind+'List']||[]).forEach((owned,i)=>{
    if(!owned)return;
    const price=economy.finishes?.[kind]?.[i];
    if(Number.isFinite(price)){finishes+=cents(price);finishEntries.push({name:`${kind} finish ${i+1}`,amount:1,unitPrice:price,value:price});}
    else warnings.push(`${kind} finish ${i} has no known price and is excluded.`);
   });
  }
  if(save.m_IsScannerRestockUnlocked){
   if(Number.isFinite(economy.scannerPrice)){finishes+=cents(economy.scannerPrice);finishEntries.push({name:'Restock scanner unlock',amount:1,unitPrice:economy.scannerPrice,value:economy.scannerPrice});}
   else warnings.push('Scanner unlock price is unavailable and excluded.');
  }
  add('Shop finishes & scanner',finishes/100,'Purchased wall, floor and ceiling finishes, plus scanner unlock.',finishEntries);
 }
 if(cash==null)warnings.push('Current money is unavailable in this save.');
 return {total:rows.reduce((n,r)=>n+cents(r.value),0)/100,rows,collection,
  complete:!warnings.length,warnings,
  basis:'Estimated asset value: cards and merchandise at current saved market prices; furniture and unlocks at current catalog purchase costs, not resale values. Excludes spent/loaded consumables, customer-held items, pending deliveries and unpaid bills.'};
}
