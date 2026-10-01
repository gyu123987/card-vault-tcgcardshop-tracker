import test from 'node:test';
import assert from 'node:assert/strict';
import {evolutionFilterIds,collapsedDeckEntries} from '../lib/model.mjs';
import {collectionForecast} from '../lib/analytics.mjs';

test('evolution chips distinguish basic, connected and standalone; missing excludes deck members',()=>{
 const cards=[{id:'a',baseId:'1',previousEvolution:0},{id:'b',baseId:'2',previousEvolution:1},{id:'c',baseId:'3',previousEvolution:2},{id:'d',baseId:'4',previousEvolution:0}];
 assert.deepEqual([...evolutionFilterIds(cards,['basic'])],['1','4']);
 assert.deepEqual([...evolutionFilterIds(cards,['line'])],['1','2','3']);
 assert.deepEqual([...evolutionFilterIds(cards,['standalone'])],['4']);
 assert.deepEqual([...evolutionFilterIds(cards,[],[{cardId:'b',amount:4}],['missing'])],['1','3']);
 assert.deepEqual([...evolutionFilterIds(cards,['basic'],[{cardId:'b',amount:4}],['missing'])],['1']);
 assert.equal(evolutionFilterIds(cards,[],[],['missing']).size,0);
});

test('collapsed deck sums copies and shows the most expensive selected variant without mutation',()=>{
 const cards=[{id:'a',baseId:'1',price:2},{id:'b',baseId:'1',price:100},{id:'c',baseId:'1',price:999},{id:'d',baseId:'2',price:1}];
 const entries=[{cardId:'a',amount:3},{cardId:'b',amount:1},{cardId:'d',amount:2}];
 assert.deepEqual(collapsedDeckEntries(entries,cards),[{cardId:'b',amount:4},{cardId:'d',amount:2}]);
 assert.equal(entries[0].amount,3);
});

test('individual pack forecast excludes other rarity targets and removes 25% dilution',()=>{
 const cards=['Common','Rare','Epic','Legendary'].flatMap((rarity,r)=>Array.from({length:10},(_,i)=>({id:`${r}:${i}`,baseId:`${r}:${i}`,setId:'Tetramon',expansion:0,rarity,border:0,foil:false,owned:r===0&&i===0?0:1})));
 const complete=c=>c.owned>0;
 const mixed=collectionForecast(cards,'Tetramon',complete),common=collectionForecast(cards,'Tetramon',complete,2,1,'Common');
 assert.equal(common.missing,1);assert.ok(Math.abs(common.chance-mixed.chance*4)<1e-12);
 assert.ok(Math.abs(common.next*4-mixed.next)<1e-10);
 const rare=collectionForecast(cards,'Tetramon',complete,2,1,'Rare');
 assert.equal(rare.missing,0);assert.equal(rare.complete,0);
});
