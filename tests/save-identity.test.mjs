import test from 'node:test';
import assert from 'node:assert/strict';
import {playthroughFingerprint,resolveHistoryProfile} from '../lib/save-identity.mjs';
const save=(offset=0)=>({m_CurrentDay:12,m_GenCardMarketPriceList:Array.from({length:128},(_,i)=>({generatedMarketPrice:i+1+offset,pricePercentChangeList:0}))});
test('same playthrough shares history across slots and market fluctuations; new game separates',()=>{
 const a=save(),b=structuredClone(a);b.m_CurrentDay=1;b.m_PlayerName='Renamed';b.m_GenCardMarketPriceList[0].pricePercentChangeList=30;b.m_GenCardMarketPriceList.push({generatedMarketPrice:99});
 assert.equal(resolveHistoryProfile(a,'/saves','slot0',{}).id,resolveHistoryProfile(b,'/saves','slot2',{}).id);
 assert.notEqual(playthroughFingerprint(a),playthroughFingerprint(save(1)));
});
test('incomplete saves persist separate fallback histories, isolating a new day-one game',()=>{
 const profiles={},s={m_CurrentDay:10};
 const first=resolveHistoryProfile(s,'/saves','slot0',profiles).id;
 assert.equal(resolveHistoryProfile({...s,m_CurrentDay:11},'/saves','slot0',profiles).id,first);
 assert.notEqual(resolveHistoryProfile(s,'/saves','slot1',profiles).id,first);
 assert.notEqual(resolveHistoryProfile({m_CurrentDay:1},'/saves','slot0',profiles).id,first);
 assert.equal(playthroughFingerprint({}),null);
});
