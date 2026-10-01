import test from 'node:test';
import assert from 'node:assert/strict';
import {SPECIAL_PACK_COUNTS,specialPackIndex,packOdds,savedGameMinute,snapshotSeries,missProbability,collectionForecast,independentCompletionMean,recentSyncRange} from '../lib/analytics.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);
test('all 100000 special-pack rolls and overlapping boundary follow the game branches',()=>{
 assert.deepEqual(SPECIAL_PACK_COUNTS,[98112,501,311,251,201,71,121,100,49,21,9,51,1,201]);
 assert.equal(specialPackIndex(1130),8);assert.equal(specialPackIndex(1131),7);
 assert.equal(specialPackIndex(1231),0);assert.equal(specialPackIndex(1000),12);
});
test('sequential edition probabilities, independent foil, and pack overrides',()=>{
 const o=packOdds();near(o.variants.reduce((s,v)=>s+v.normalCard,0),1);
 near(o.variants.filter(v=>v.foil).reduce((s,v)=>s+v.normalCard,0),.05);
 const fullFoil=o.variants.find(v=>v.border===5&&v.foil);near(fullFoil.normalCard,.0025*.05);
 near(fullFoil.pack,.98112*(.999*(1-(1-.000125)**7)+.001*(1-(1-.000125)**6))+.00009);
 near(o.variants.find(v=>v.border===4&&!v.foil).normalCard,.9975*.01*.95);
 assert.equal(packOdds(7).variants.at(-1).name,'Full Art');assert.equal(packOdds(7).variants[2].name,'Silver');
});
test('Ghost pack probabilities include forced seven-card packs and shared foil overrides',()=>{
 const t=packOdds(0),d=packOdds(1);near(t.ghostPack,.00052+.99948*.001);near(d.ghostPack,.00052+.99948*.002);
 near(t.ghostFoilPack,.00001+.001*(.98112*.05+.00501));
 near(t.ghosts[2].pack,.00001*(1-.5**7)+.001*(.98112*.05+.00501)/2);
 assert.equal(t.ghosts[2].pack,t.ghosts[3].pack);near(t.allGhost,.00052);
 for(const o of [t,d,packOdds(7)])for(const v of [...o.variants,...o.ghosts])assert.ok(v.pack>=0&&v.pack<=1);
});
test('level-one packs disable Ghost and special outcomes',()=>{
 const o=packOdds(7,1);assert.equal(o.ghostPack,0);assert.equal(o.specialPack,0);
 for(const v of o.variants)near(v.pack,1-(1-v.normalCard)**7);
});
test('save clock uses 24-hour time and rejects absent or invalid values',()=>{
 assert.equal(savedGameMinute({m_LightTimeData:{m_TimeHour:21,m_TimeMin:0}}),1260);
 assert.equal(savedGameMinute({m_LightTimeData:{m_TimeHour:11,m_TimeMin:15}}),675);
 for(const s of [{},{m_LightTimeData:{m_TimeHour:25,m_TimeMin:0}},{m_LightTimeData:{m_TimeHour:12,m_TimeMin:60}}])assert.equal(savedGameMinute(s),null);
});
test('timeline retains every sync including equal minutes and legacy same-day observations',()=>{
 const rows=[{day:4,gameMinute:720,value:5,at:'2026-01-01T12:00:00Z'},{day:1,value:1,at:'2026-01-01T10:00:00Z'},{day:4,gameMinute:600,value:3},{day:4,gameMinute:600,value:4},{day:4,value:2},{day:1,value:2},{day:5,value:null}];
 const p=snapshotSeries(rows,'value');assert.equal(p.length,6);assert.equal(p.filter(p=>p.x===4+600/1440).length,2);assert.equal(p.filter(p=>p.x===1).length,2);assert.match(p.at(-1).label,/12:00 in game/);
 assert.deepEqual(snapshotSeries([], 'value'),[]);
});
test('recent window adapts to available width and does not split coincident syncs',()=>{
 const p=Array.from({length:100},(_,i)=>({x:i}));assert.deepEqual(recentSyncRange(p,520),[80,99]);assert.deepEqual(recentSyncRange(p,260),[90,99]);assert.deepEqual(recentSyncRange([{x:4}]),[4,4]);
 assert.deepEqual(recentSyncRange([{x:1},...Array.from({length:10},(_,i)=>({x:100+i/100}))],520),[100,100.09]);
 const cluster=Array.from({length:40},()=>({x:8}));assert.deepEqual(recentSyncRange(cluster,260),[8,8]);
});
test('without-replacement missing probability agrees with exhaustive subsets',()=>{
 const values=[.2,.3,.6,.8],exact=(.2*.3+.2*.6+.2*.8+.3*.6+.3*.8+.6*.8)/6;
 near(missProbability(values,2,false),exact);near(missProbability(values,2,true),(.475)**2);near(missProbability([0,1,1,1],3,false),.25);
});
const makePool=(setId,expansion,n=8)=>Array.from({length:n},(_,i)=>Array.from({length:12},(_,j)=>({setId,expansion,baseId:String(i),rarity:'Common',border:j%6,foil:j>=6,owned:1}))).flat();
test('next-new forecasts use actual missing identities and completed sets return zero',()=>{
 const cards=makePool('Tetramon',0);assert.equal(collectionForecast(cards,'Tetramon',c=>c.owned>0).complete,0);
 cards[0].owned=0;const f=collectionForecast(cards,'Tetramon',c=>c.owned>0);near(f.next,1/f.probabilities[0]);near(f.complete,f.next);assert.equal(f.missing,1);
 const all=collectionForecast(cards,'Tetramon',()=>false);near(all.chance,1-.00052);
});
test('Ascension repeats and Ghost special packs use union probabilities, not summed card odds',()=>{
 const asc=makePool('Ascension',7);asc[0].owned=0;const f=collectionForecast(asc,'Ascension',c=>c.owned>0);near(f.next,1/f.probabilities[0]);
 const ghost=Array.from({length:20},(_,i)=>[false,true].map(foil=>({setId:'Ghost',expansion:2,baseId:String(i),foil}))).flat();
 const g=collectionForecast(ghost,'Ghost',()=>false,2,1),o=packOdds(1);near(g.chance,o.ghosts[0].pack+o.ghosts[2].pack);
 assert.equal(collectionForecast(ghost,'Ghost',()=>false,1).next,Infinity);
});
test('completion approximation has correct one-target and equal-rate limiting cases',()=>{
 near(independentCompletionMean([]),0);near(independentCompletionMean([.01]),100);assert.equal(independentCompletionMean([0]),Infinity);
 const mean=independentCompletionMean([.0001,.0001]);assert.ok(Math.abs(mean-15000)/15000<.002);
});

test('candidate-copy goals credit all owned copies and estimate repeated arrivals',()=>{
 const cards=makePool('Tetramon',0).map(c=>({...c,owned:3}));cards[0].owned=1;
 const need=c=>Math.max(0,3-c.owned);
 const f=collectionForecast(cards,'Tetramon',()=>false,2,1,'Common',need);
 assert.equal(f.missing,1);assert.equal(f.copiesMissing,2);near(f.complete,2*f.next);
 cards[0].owned=3;assert.equal(collectionForecast(cards,'Tetramon',()=>false,2,1,'Common',need).complete,0);
 const once=independentCompletionMean([.001,.002],[1,1]);const twice=independentCompletionMean([.001,.002],[2,2]);assert.ok(twice>once&&Number.isFinite(twice));
});
