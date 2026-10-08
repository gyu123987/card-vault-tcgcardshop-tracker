import crypto from 'node:crypto';
import path from 'node:path';

// Initial random base prices are persisted across saves. Daily fluctuations
// change percentages, not these prices. Fixed prefix avoids catalog growth.
export function playthroughFingerprint(save){
 const prices=save.m_GenCardMarketPriceList?.slice(0,128).map(p=>p?.generatedMarketPrice);
 if(prices?.length!==128||prices.some(p=>!Number.isFinite(p))||!prices.some(p=>p>0))return null;
 return 'prices-v1:'+crypto.createHash('sha256').update(JSON.stringify(prices)).digest('hex');
}
export function resolveHistoryProfile(save,folder,file,profiles){
 const fingerprint=playthroughFingerprint(save);
 if(fingerprint)return {id:fingerprint,basis:'Shared across saves with matching initial card prices'};
 const key=path.resolve(folder).toLowerCase()+'|'+file;
 const day=Number(save.m_CurrentDay)||0;
 let profile=profiles[key];
 // Older/incomplete saves cannot be linked reliably. Prefer separating them
 // when the day rolls back rather than combining a fresh game with old history.
 if(!profile||day<profile.lastDay)profile={id:'local:'+crypto.randomUUID(),lastDay:day};
 profile.lastDay=day;profiles[key]=profile;
 return {id:profile.id,basis:'Separate save history; no initial-price fingerprint available'};
}
