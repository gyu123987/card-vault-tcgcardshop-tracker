import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionValuation,expansionCost,netWorth,itemMarketPrice,merchandiseValuation} from '../lib/valuation.mjs';

test('collection breakdown counts each copy once across sets, grades and locations',()=>{
 const cards=[{expansion:0,price:10,available:2,inDeck:3,elsewhere:4,gradedValue:500,value:590},
  {expansion:1,price:2,available:1,inDeck:0,gradedValue:0,value:2},
  {expansion:7,price:3,available:1,inDeck:0,gradedValue:0,value:3},
  {expansion:2,price:4,available:1,inDeck:0,gradedValue:0,value:4},
  {expansion:2,price:5,available:1,inDeck:0,gradedValue:0,value:5},
  {expansion:3,price:100,available:1,inDeck:0,gradedValue:0,value:100}];
 const result=collectionValuation(cards);
 assert.deepEqual(result.rows.map(r=>r.value),[20,2,3,9,500,30,40]);
 assert.equal(result.total,604);
});
test('expansion costs preserve game tier boundaries and zero-based purchase indexes',()=>{
 assert.equal(expansionCost(0),300);assert.equal(expansionCost(4),900);
 assert.equal(expansionCost(19),6000);assert.equal(expansionCost(20),10800);
 assert.equal(expansionCost(24),14700);assert.equal(expansionCost(25),20300);
 assert.equal(expansionCost(0,true),1000);assert.equal(expansionCost(7,true),8700);
 assert.equal(expansionCost(8,true),16600);
});
const economy={items:[],furniture:{10:{price:100}},nonPurchasableTypes:[1],decorations:[{price:0},{price:20}],
 licenses:[{price:0},{price:1000},{price:5000}],finishes:{Wall:[0,50],Floor:[0,60],Ceiling:[0,70]},shopBPrice:5000,scannerPrice:12000};
test('net worth uses precise cash, owned fixtures, purchases and licenses without lifetime-spend duplication',()=>{
 const save={m_CoinAmountDouble:123.45,m_CoinAmount:999,m_CardShelfSaveDataList:[{objectType:10,isBoxed:true,cardDataList:[{objectType:10}]}],
  m_InteractableObjectSaveDataList:[{objectType:1}],m_DecoObjectSaveDataList:[{decoObjectType:1}],m_DecorationInventoryList:[0,2],
  m_UnlockRoomCount:2,m_UnlockWarehouseRoomCount:1,m_IsWarehouseRoomUnlocked:true,
  m_IsItemLicenseUnlocked:[true,true,false],m_UnlockedDecoWallList:[true,true],m_UnlockedDecoFloorList:[true,false],
  m_UnlockedDecoCeilingList:[true,true],m_IsScannerRestockUnlocked:true,m_GameReportDataCollectPermanent:{upgradeCost:-999999}};
 const result=netWorth(save,[{expansion:0,available:1,price:10,value:10}],economy);
 assert.equal(result.complete,true);
 assert.deepEqual(result.rows.map(r=>r.value),[123.45,10,0,160,6700,1000,12120]);
 assert.equal(result.total,20113.45);
 for(const row of result.rows)assert.equal(Math.round(row.entries.reduce((n,e)=>n+(e.value||0),0)*100)/100,row.value);
 assert.equal(save.m_CoinAmountDouble,123.45);
});
test('old caches and unknown furniture produce visible partial estimates, not fabricated prices',()=>{
 const old=netWorth({m_CoinAmount:50},[],null);
 assert.equal(old.total,50);assert.equal(old.complete,false);assert.equal(old.rows.find(r=>r.label==='Furniture & decorations').value,null);
 const unknown=netWorth({m_CoinAmountDouble:0,m_ShelfSaveDataList:[{objectType:999}]},[],economy);
 assert.equal(unknown.complete,false);assert.match(unknown.warnings[0],/no known purchase price/);
});
test('merchandise uses market prices and counts rack boxes once, with location detail',()=>{
 const save={m_GeneratedMarketPriceList:[10,20],m_ItemPricePercentChangeList:[25,-10],m_SetItemPriceList:[999,999],
  m_CurrentTotalItemCountList:[9999,9999],m_WarehouseShelfSaveDataList:[{compartmentItemType:[0,0]}],
  m_PackageBoxItemSaveDataList:[{isStored:true,itemTypeAmount:{itemType:0,amount:4}},{isStored:false,itemTypeAmount:{itemType:1,amount:2}}],
  m_ShelfSaveDataList:[{itemTypeAmountList:[{itemType:0,amount:3}]}],
  m_CardItemCombiShelfSaveDataList:[{isBoxed:true,itemTypeAmountList:[{itemType:1,amount:1}]}],
  m_HoldItemTypeList:[0],m_AutoPackOpenerSaveDataList:[{itemTypeList:[0,0],packOpenedCount:50}],
  m_WorkbenchSaveDataList:[{itemTypeList:[1]}]};
 assert.equal(itemMarketPrice(save,0),12.5);assert.equal(itemMarketPrice(save,1),18);
 const result=merchandiseValuation(save,{items:[{name:'Pack'},{name:'Box'}]});
 assert.equal(result.total,197);assert.equal(result.unknown,0);
 assert.equal(result.entries.reduce((n,e)=>n+e.amount,0),14);
 assert.equal(result.entries.find(e=>e.location==='Storage racks').amount,4);
 assert.equal(itemMarketPrice({m_GeneratedMarketPriceList:[1.125],m_ItemPricePercentChangeList:[0]},0),1.12);
 assert.equal(itemMarketPrice({m_GeneratedMarketPriceList:[1.375],m_ItemPricePercentChangeList:[0]},0),1.38);
});
test('missing saved merchandise prices are flagged rather than using purchase or asking prices',()=>{
 const save={m_CoinAmountDouble:5,m_SetItemPriceList:[500],m_PackageBoxItemSaveDataList:[{itemTypeAmount:{itemType:0,amount:2}}]};
 const result=netWorth(save,[],economy);
 assert.equal(result.total,5);assert.equal(result.complete,false);
 assert.match(result.warnings[0],/2 merchandise units/);
 assert.equal(result.rows.find(r=>r.label.startsWith('Merchandise')).entries[0].value,null);
});
