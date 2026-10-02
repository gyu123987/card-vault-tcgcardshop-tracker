import {savedGameMinute} from './analytics.mjs';
import {netWorth} from './valuation.mjs';
export const roundMoney = n => { const x=Math.fround(Math.fround(n)*100), f=Math.floor(x), d=x-f; return (d===.5 ? f+(f%2) : Math.round(x))/100; };
export function priceOf(p, percent=p?.pricePercentChangeList||0) {
 if(typeof p==='number') return p;
 return roundMoney(Math.fround(Math.fround(p?.generatedMarketPrice||0)*Math.fround(1+Math.fround(percent/100))));
}
export function compactId(c, sets) {
 const set=sets.find(s=>s.expansion===c.expansionType && (s.expansion!==2 || s.isDestiny===!!c.isDestiny));
 return set?`${set.id}:${c.cardSaveIndex}`:null;
}
export function signature(entries) {
 const totals=new Map(); for(const e of entries) totals.set(e.cardId,(totals.get(e.cardId)||0)+e.amount);
 return [...totals].filter(([,n])=>n>0).sort(([a],[b])=>a.localeCompare(b)).map(([a,n])=>`${a}=${n}`).join('|');
}
// All card-bearing display furniture in the installed EObjectType enum.
// Read every record in both shelf families, even an unknown future object type.
export const DISPLAY_TYPES={10:'Card shelves',23:'Vintage card tables',24:'Card display tables',25:'Card display shelves A',26:'Big card display shelves',40:'Wall card displays',41:'Small wall displays',42:'Big wall displays',43:'Big white wall displays',44:'Projectors',45:'Large projectors',46:'Small projectors',47:'3 × 2 wall displays',55:'Tournament prize shelves'};
export function validateCover(ids,entries){
 if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!entries.some(e=>e.cardId===id)))throw Error('Choose up to three different cards from this deck.');
 return [...ids];
}
export function normalize(save,catalog) {
 if(!Array.isArray(save.m_CardCollectedList)) throw Error('This is not a supported TCG Card Shop Simulator save.');
 const cards=catalog.cards.map(c=>{
  const suffix=catalog.sets.find(s=>s.id===c.setId).suffix;
  const p=save['m_GenCardMarketPriceList'+suffix]?.[c.saveIndex];
  return {...c,available:save['m_CardCollectedList'+suffix]?.[c.saveIndex]||0,everCollected:!!save['m_IsCardCollectedList'+suffix]?.[c.saveIndex],inDeck:0,elsewhere:0,locations:{},grades:[],price:priceOf(p),history:(p?.pastPricePercentChangeList||[]).map(n=>priceOf(p,n)),marketChange:p?.pricePercentChangeList||0};
 });
 const byId=new Map(cards.map(c=>[c.id,c]));
 const decks=(save.m_DeckCompactCardDataList||[]).map((d,i)=>({id:`game-${i}`,name:d.deckName,source:'game',entries:(d.compactCardDataAmountList||[]).map(e=>({cardId:compactId(e,catalog.sets),amount:e.amount})).filter(e=>e.cardId),deckBoxIndex:d.deckBoxIndex,playmatIndex:d.playmatIndex}));
 for(const d of decks) for(const e of d.entries) {const c=byId.get(e.cardId);if(c)c.inDeck+=e.amount;}
 function physicalId(c) {
  const set=catalog.sets.find(s=>s.expansion===c.expansionType && (s.expansion!==2||s.isDestiny===!!c.isDestiny));
  if(!set || !c.monsterType)return null;
  const i=set.monsterOrder.indexOf(c.monsterType), half=set.expansion===2?1:6;
  return i<0?null:`${set.id}:${i*half*2+(c.borderType||0)+(c.isFoil?half:0)}`;
 }
 const graded=[],displayHoldings=[];
 for(const c of cards){
  const suffix=catalog.sets.find(s=>s.id===c.setId).suffix,p=save['m_GenCardMarketPriceList'+suffix]?.[c.saveIndex];
  const multipliers=save.m_GenGradedCardPriceMultiplierList||[];
  c.gradePrices=Array.from({length:10},(_,i)=>{const grade=i+1,m= multipliers[(c.saveIndex*10+i)%multipliers.length];
   const bonus=grade===10?12:grade===9?8:grade===8?4:grade===7?2:0;
   const price=percent=>m==null?null:Math.round(Math.fround(roundMoney(Math.fround(Math.fround(Math.fround(m)*Math.fround(p?.generatedMarketPrice||0))*Math.fround(1+Math.fround(percent/100))))+Math.fround(m*bonus))*100)/100;
   return {grade,price:price(p?.pricePercentChangeList||0),history:(p?.pastPricePercentChangeList||[]).map(price)};
  });
 }
 const locationName=x=>DISPLAY_TYPES[x.objectType]||`Other card display (type ${x.objectType??'unknown'})`;
 function add(c,location,compact=false,onDisplay=false) {
  const id=compact?compactId(c,catalog.sets):physicalId(c),target=byId.get(id);if(!target)return;
  // In graded compact records, `amount` stores the grade, not a copy count.
  if(c.cardGrade>0 || compact&&c.gradedCardIndex>0) {const grade=c.cardGrade||(compact?c.amount:null);const g={cardId:id,location,grade,amount:1,price:target.gradePrices[grade-1]?.price??null};graded.push(g);target.grades.push(g);if(onDisplay)displayHoldings.push({...g,value:g.price||0});return;}
  const n=compact?c.amount:1;if(onDisplay)displayHoldings.push({cardId:id,location,grade:0,amount:n,price:target.price,value:n*target.price});target.elsewhere+=n;target.locations[location]=(target.locations[location]||0)+n;
 }
 for(const x of save.m_CardShelfSaveDataList||[]) for(const c of x.cardDataList||[])add(c,locationName(x),false,x.objectType!==10&&x.objectType!==50);
 for(const x of save.m_CardItemCombiShelfSaveDataList||[]) for(const c of x.cardDataList||[])add(c,locationName(x),false,x.objectType!==10&&x.objectType!==50);
 for(const x of save.m_CardStorageShelfSaveDataList||[])for(const c of x.compactCardDataAmountList||[])add(c,'Storage',true);
 for(const x of save.m_BulkDonationSaveDataList||[])for(const c of x.compactCardDataAmountList||[])add(c,'Donation box',true);
 for(const x of save.m_AutoPackOpenerSaveDataList||[])for(const c of x.compactCardDataAmountList||[])add(c,'Pack openers',true);
 for(const x of save.m_PackageBoxCardSaveDataList||[])for(const c of x.cardDataList||[])add(c,'Card boxes');
 for(const c of save.m_HoldCardDataList||[])add(c,'Held cards');
 for(const x of save.m_GradeCardInProgressList||[])for(const c of x.m_CardDataList||[])add(c,'At grading');
 for(const c of save.m_CurrentGradeCardSubmitSet?.m_CardDataList||[])add(c,'Grading submission');
 for(const c of save.m_GradedCardInventoryList||[])add(c,'Graded inventory',true);
 for(const c of cards){c.ungradedOwned=c.available+c.inDeck+c.elsewhere;c.gradedCount=c.grades.length;c.gradedValue=c.grades.reduce((n,g)=>n+(g.price||0),0);c.owned=c.ungradedOwned+c.gradedCount;c.value=Math.round((c.ungradedOwned*c.price+c.gradedValue)*100)/100;c.everCollected ||= c.owned>0;}
 const displayCoverage=Object.entries(DISPLAY_TYPES).map(([type,name])=>{const fixtures=[...(save.m_CardShelfSaveDataList||[]),...(save.m_CardItemCombiShelfSaveDataList||[])].filter(x=>x.objectType===Number(type));return {type:Number(type),name,fixtures:fixtures.length,copies:fixtures.reduce((n,x)=>n+(x.cardDataList||[]).filter(c=>physicalId(c)).length,0)};});
 return {cards,decks,sets:catalog.sets,graded,displayCoverage,displayHoldings,netWorth:netWorth(save,cards,catalog.economy),permanentReport:save.m_GameReportDataCollectPermanent||{},currentReport:save.m_GameReportDataCollect||{},day:save.m_CurrentDay,gameMinute:savedGameMinute(save),level:save.m_ShopLevel,reports:save.m_GameReportDataCollectPastList||[],warnings:graded.some(g=>g.price==null)?['Some graded prices are unavailable because the save has no grading multipliers.']:[]};
}
export function validateDraft(d, cards) {
 if(typeof d.name!=='string'||!d.name.trim()||d.name.length>100)throw Error('Give the deck a name (up to 100 characters).');
 if(!Array.isArray(d.entries))throw Error('Invalid deck entries.');
 const byId=new Map(cards.map(c=>[c.id,c])), totals=new Map();let count=0;
 const entries=[];
 for(const e of d.entries){const c=byId.get(e.cardId);if(!c||!Number.isInteger(e.amount)||e.amount<1||e.amount>4)throw Error('Invalid card or quantity.');count+=e.amount;totals.set(c.baseId,(totals.get(c.baseId)||0)+e.amount);if(totals.get(c.baseId)>4)throw Error(`Only four copies of ${c.name} are allowed across all variants and sets.`);const existing=entries.find(x=>x.cardId===e.cardId);if(existing)existing.amount+=e.amount;else entries.push({cardId:e.cardId,amount:e.amount});}
 if(count>50)throw Error('A deck may contain at most 50 cards.');
 return {name:d.name.trim(),entries,coverCardIds:validateCover((d.coverCardIds||[]).filter(id=>entries.some(e=>e.cardId===id)),entries)};
}
export function allocate(cards,baseId,amount,preferredSet,strategy='cheapest') {
 const candidates=cards.filter(c=>c.baseId===baseId&&c.available>0&&[0,1,2,7].includes(c.expansion)).sort((a,b)=>(strategy==='quantity'?b.available-a.available:strategy==='expensive'?b.price-a.price:a.price-b.price)||a.id.localeCompare(b.id));
 const entries=[];let remaining=amount;
 for(const c of candidates){const n=Math.min(c.available,remaining);if(n>0)entries.push({cardId:c.id,amount:n});remaining-=n;if(!remaining)break;}
 if(remaining){const fallback=cards.find(c=>c.baseId===baseId&&c.setId===preferredSet)||candidates[0];if(fallback){const e=entries.find(e=>e.cardId===fallback.id);if(e)e.amount+=remaining;else entries.push({cardId:fallback.id,amount:remaining});}}
 return entries;
}
export function exportDeck(d,cards) {
 const byId=new Map(cards.map(c=>[c.id,c]));const names={0:'Tetramon',1:'Destiny',2:'Ghost',3:'Megabot',4:'FantasyRPG',5:'CatJob',7:'Ascension'};
 return d.entries.map(e=>{const c=byId.get(e.cardId);if(!c)throw Error('Unknown card');return `${e.amount}X ${c.name} ${names[c.expansion]} ${c.isDestiny?'B':'N'} ${String(c.saveIndex+1).padStart(3,'0')}`;}).join('\n');
}
export function reconcile(drafts,gameDecks) {
 const used=new Set();return drafts.map(d=>{const sig=signature(d.entries);const match=gameDecks.find(g=>!used.has(g.id)&&signature(g.entries)===sig);if(match)used.add(match.id);return {...d,status:match?'in-game':d.wasInGame?'draft':d.exportedAt?'exported':'draft',wasInGame:d.wasInGame||!!match,gameId:match?.id||null,replacementSignature:match?sig:d.replacementSignature||null,detachedReason:match?null:d.status==='in-game'?'The saved game deck no longer matches this local build. Its cards and W–L were preserved.':d.detachedReason||null};});
}
// Recovered from the installed game's RestockManager.OnDayStarted.
// Fresh integer rolls at every branch: 96% high-grade branch, then 40/40/50/50/50%.
export const GRADING_RULES={
 probabilities:[.003,.003,.006,.012,.0592,.0432,.0864,.1728,.2304,.384],
 deliveryFee:10,maxBatch:8,
 services:[{name:'Value',days:12,fee:10},{name:'Standard',days:7,fee:40},{name:'Express',days:4,fee:200},{name:'Premium',days:2,fee:1500}],
 source:'Installed game: RestockManager.OnDayStarted; GradedCardSubmitSelectScreen.EvaluateTotalCost; MonsterData grading services'
};
export function strongestStat(card){return Math.max(0,...Object.values(card.stats||{}));}
export function compareCardNumber(a,b){return a.cardNumber-b.cardNumber||a.baseId.localeCompare(b.baseId)||a.expansion-b.expansion||a.setId.localeCompare(b.setId)||a.saveIndex-b.saveIndex;}
export function gradeDistribution(currentGrade=0){
 if(!currentGrade)return GRADING_RULES.probabilities.map((probability,i)=>({grade:i+1,probability}));
 const probabilities=new Map();for(const [grade,p]of [[Math.min(10,currentGrade+1),.30],[currentGrade,.41],[Math.max(1,currentGrade-1),.29]])probabilities.set(grade,(probabilities.get(grade)||0)+p);
 return [...probabilities].sort(([a],[b])=>a-b).map(([grade,probability])=>({grade,probability}));
}
export function estimateGrading(card,currentGrade=0,serviceIndex=0,batchSize=8){
 const service=GRADING_RULES.services[serviceIndex]||GRADING_RULES.services[0],batch=Math.max(1,Math.min(8,Number(batchSize)||8)),fee=service.fee+GRADING_RULES.deliveryFee/batch;
 const outcomes=gradeDistribution(currentGrade).map(o=>({...o,value:card.gradePrices?.[o.grade-1]?.price}));
 const base=currentGrade?card.gradePrices?.[currentGrade-1]?.price:card.price;
 if(!Number.isFinite(base)||outcomes.some(o=>!Number.isFinite(o.value)))return null;
 const expected=outcomes.reduce((sum,o)=>sum+o.probability*o.value,0),netValue=expected-fee,gain=netValue-base;
 return {outcomes,expected,netValue,gain,base,fee,service,batch,lossChance:outcomes.reduce((sum,o)=>sum+(o.value-fee<base?o.probability:0),0)};
}
// Equivalent border slots: Ascension names differ, but borderless full art is slot 5 only.
export function editionOf(c){return c.expansion===2?'Ghost':['Base','First Edition','Silver','Gold','EX','Full Art'][c.border];}
export function matchesFacets(c,facets){
 return Object.entries(facets).every(([key,values])=>!values.length||(key==='keywords'?values.some(v=>hasEffectKeyword(c,v)):values.includes(key==='sets'?c.setId:key==='rarities'?c.rarity:key==='editions'?editionOf(c):key==='foils'?(c.foil?'Foil':'Non-foil'):String(c.elementIndex))));
}
export function representativeCard(cards,preferredSet='Ascension'){
 const pool=cards.filter(c=>c.setId===preferredSet),choices=pool.length?pool:cards;
 return choices.find(c=>!c.foil&&c.border===5)||choices.find(c=>!c.foil)||choices[0];
}
export function groupCardIdentities(cards,preferredSet){
 const groups=new Map();for(const c of cards){if(!groups.has(c.baseId))groups.set(c.baseId,[]);groups.get(c.baseId).push(c);}
 return [...groups.values()].map(variants=>{const chosen=representativeCard(variants,preferredSet),g={...chosen,variants,everCollected:variants.some(c=>c.everCollected)};for(const k of ['owned','available','value','gradedCount','inDeck','elsewhere'])g[k]=variants.reduce((n,c)=>n+(c[k]||0),0);return g;});
}
export function matchesStatRules(card,rules=[]){return rules.every(r=>{const v=card.stats?.[r.element+'Element'];return Number.isFinite(v)&&(r.operator==='>'?v>r.value:r.operator==='<'?v<r.value:r.operator==='>='?v>=r.value:r.operator==='<='?v<=r.value:v===r.value);});}
export function parseStatRule(query){const m=query.trim().match(/^(fire|earth|water|wind)\s*(>=|<=|>|<|=)\s*(\d+)$/i);return m?{element:m[1][0].toUpperCase()+m[1].slice(1).toLowerCase(),operator:m[2],value:Number(m[3])}:null;}
// The game's report CopyData/ResetData omit duelWinCount. Derive only observed
// counter increases, retaining multi-day gaps rather than attributing them to a day.
export function observedDuelWins(snapshots){
 const points=snapshots.filter(s=>Number.isFinite(s.duelWins)),rows=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],reset=b.duelWins<a.duelWins||b.day<a.day,label=a.day===b.day?`Day ${b.day}`:`Days ${a.day}–${b.day}`;const last=rows.at(-1);
  if(!reset&&a.day===b.day&&last?.label===label&&last.wins!=null)last.wins+=b.duelWins-a.duelWins;
  else rows.push({label,wins:reset?null:b.duelWins-a.duelWins,multipleDays:a.day!==b.day,reset});
 }
 return rows;
}
export const EFFECT_KEYWORDS={Discard:/\bdiscard\w*/i,Draw:/\bdraw\w*/i,Boost:/\bboost\w*/i,Freeze:/\bfreez\w*|\bfrozen\b/i,Search:/\bsearch\w*/i,Shuffle:/\bshuffl\w*/i,Evolve:/\bevolv\w*|\bevolution\b/i,Guardian:/\bguardian\b/i,'Tamer Shield':/\btamer shield\b/i,Destroy:/\bdestroy\w*/i,Return:/\breturn\w*/i,'Look at deck':/\blook at top\b/i};
export function hasEffectKeyword(card,keyword){return EFFECT_KEYWORDS[keyword]?.test(card.description||'')||false;}
export function compareCards(a,b,key='number',direction='asc'){
 const sign=direction==='desc'?-1:1;
 if(key==='number')return sign*compareCardNumber(a,b);
 const numeric=c=>key==='gradeGain'?c.gradingEstimate?.gain||0:key==='strongest'?strongestStat(c):c[key]||0;
 return sign*(key==='name'?a.name.localeCompare(b.name):numeric(a)-numeric(b))||compareCardNumber(a,b);
}
export function gradingStock(card,grade=0,displayHoldings=[],copies='all'){
 const onDisplay=displayHoldings.filter(g=>g.cardId===card.id&&g.grade===grade).reduce((n,g)=>n+g.amount,0);
 const inventory=grade?card.grades.filter(g=>g.grade===grade&&g.location==='Graded inventory').length:card.available;
 const owned=grade?card.grades.filter(g=>g.grade===grade).length:card.ungradedOwned,eligible=inventory+onDisplay;
 return {owned,inventory,onDisplay,eligible:copies==='duplicates'?Math.min(eligible,Math.max(0,owned-1)):copies==='single'?(owned===1?eligible:0):eligible};
}
export function completionGrades(mode='any') {
 if(mode==='any')return null;
 if(mode==='ungraded')return [0];
 if(/^psa-(10|[1-9])$/.test(mode))return Array.from({length:11-Number(mode.slice(4))},(_,i)=>i+Number(mode.slice(4)));
 if(/^conditions:/.test(mode))return [...new Set(mode.slice(11).split(',').filter(x=>/^(10|[0-9])$/.test(x)).map(Number))].sort((a,b)=>a-b);
 return null;
}
export function conditionOwned(card,grade){return grade===0?card.ungradedOwned>0:card.grades.some(g=>g.grade===grade);}
export function completionSatisfied(card,mode='any'){
 const choices=completionGrades(mode);
 return choices===null?card.owned>0:mode.startsWith('conditions:')?choices.every(g=>conditionOwned(card,g)):choices.some(g=>conditionOwned(card,g));
}
export function completionProgress(cards,mode='any'){
 const choices=mode.startsWith('conditions:')?completionGrades(mode):null;
 const total=cards.length*(choices?.length||1),owned=cards.reduce((n,c)=>n+(choices?choices.filter(g=>conditionOwned(c,g)).length:Number(completionSatisfied(c,mode))),0);
 return {owned,total,missing:total-owned,percent:total?owned/total*100:0};
}
export function collectionConditionRows(cards,mode='any'){
 const choices=completionGrades(mode),exact=mode.startsWith('conditions:');
 return cards.flatMap(c=>{
  const complete=completionSatisfied(c,mode),grades=[...new Set(c.grades.map(g=>g.grade))].sort((a,b)=>a-b);
  const missing=exact?choices.filter(g=>!conditionOwned(c,g)):complete?[]:[choices?.[0]||0];
  const row=(grade,placeholder=false)=>{const holdings=grade?c.grades.filter(g=>g.grade===grade):[],owned=grade?holdings.length:c.ungradedOwned,price=grade?c.gradePrices[grade-1]?.price:c.price;
   return {...c,displayGrade:grade,rowKey:`${c.id}:psa-${grade}`,condition:grade?'Graded':'Ungraded',owned,price,value:grade?holdings.reduce((n,g)=>n+(g.price||0),0):Math.round(owned*c.price*100)/100,available:grade?holdings.filter(g=>g.location==='Graded inventory').length:c.available,gradedCount:grade?owned:0,actualGradedCount:c.gradedCount,completionMet:complete,isTargetPlaceholder:placeholder,rowMissing:missing.includes(grade),gradedVersionOwned:!grade&&!owned&&complete&&c.gradedCount>0};
  };
  return [row(0),...[...new Set([...grades,...missing.filter(g=>g>0)])].sort((a,b)=>a-b).map(g=>row(g,!grades.includes(g)))];
 });
}

export function validateRecord(record={wins:0,losses:0}){
 if(!record||!Number.isSafeInteger(record.wins)||!Number.isSafeInteger(record.losses)||record.wins<0||record.losses<0||record.wins>999999||record.losses>999999)throw Error('Wins and losses must be whole numbers from 0 to 999999.');
 return {wins:record.wins,losses:record.losses};
}
export function evolutionIds(cards,bases){
 const connected=new Set(bases.map(String)),identities=[...new Map(cards.map(c=>[String(c.baseId),c])).values()];let changed=true;
 while(changed){changed=false;for(const c of identities){const id=String(c.baseId),parent=String(c.previousEvolution||'');if(!c.previousEvolution)continue;if(connected.has(id)||connected.has(parent)){for(const k of [id,parent])if(!connected.has(k)){connected.add(k);changed=true;}}}}
 return connected;
}
export function missingEvolutions(deck,cards){
 const byId=new Map(cards.map(c=>[c.id,c])),present=new Set(deck.entries.map(e=>String(byId.get(e.cardId)?.baseId))),seen=new Set();return deck.entries.flatMap(e=>{const c=byId.get(e.cardId);if(!c?.previousEvolution||present.has(String(c.previousEvolution))||seen.has(c.baseId))return [];seen.add(c.baseId);return [{baseId:c.baseId,name:c.name,parentId:String(c.previousEvolution),parentName:c.previousName}];});
}
export function replacementDeck(d,gameDecks){return gameDecks.find(g=>d.replacementSignature&&signature(g.entries)===d.replacementSignature)||gameDecks.find(g=>d.status==='in-game'&&g.id===d.gameId)||null;}
export function usableCopies(card,d,gameDecks){return card.available+(replacementDeck(d,gameDecks)?.entries.filter(e=>e.cardId===card.id).reduce((n,e)=>n+e.amount,0)||0);}
export function draftIssues(d,cards,gameDecks,drafts){
 const lookup=new Map(cards.map(c=>[c.id,c])),replacement=replacementDeck(d,gameDecks);
 return d.entries.flatMap(e=>{const c=lookup.get(e.cardId);if(!c)return [];const usable=usableCopies(c,d,gameDecks),other=drafts.filter(x=>x.id!==d.id&&x.status!=='in-game'),competing=other.filter(x=>x.entries.some(a=>a.cardId===e.cardId)),reserved=competing.reduce((sum,x)=>{const amount=x.entries.filter(a=>a.cardId===e.cardId).reduce((n,a)=>n+a.amount,0),r=replacementDeck(x,gameDecks);const credit=r&&r!==replacement?r.entries.filter(a=>a.cardId===e.cardId).reduce((n,a)=>n+a.amount,0):0;return sum+Math.max(0,amount-credit);},0);
  return [{cardId:e.cardId,short:Math.max(0,e.amount-usable),shared:reserved>0&&e.amount+reserved>usable,otherNames:competing.map(x=>x.name),usable,amount:e.amount}];
 });
}

export function deckSyncState(d,gameDecks){
 const original=replacementDeck(d,gameDecks);
 if(!d.replacementSignature||signature(d.entries)===d.replacementSignature)return null;
 return {pending:true,originalExists:!!original,name:original?.name||d.replacementName||'previous game deck'};
}

// Basic means no previous evolution; standalone means neither parent nor child.
export function evolutionFilterIds(cards, selected=[], deckEntries=[], deckFilter=[]){
 const children=new Set(cards.filter(c=>c.previousEvolution).map(c=>String(c.previousEvolution))),bases=new Set(deckEntries.map(e=>String(cards.find(c=>c.id===e.cardId)?.baseId))),lines=evolutionIds(cards,[...bases]);
 return new Set(cards.filter(c=>{
  const id=String(c.baseId),parent=!!c.previousEvolution,connected=parent||children.has(id);
  const stage=!selected.length||selected.some(v=>v==='basic'?!parent:v==='line'?connected:v==='standalone'?!connected:false);
  const deck=!deckFilter.length||deckFilter.some(v=>lines.has(id)&&(v!=='missing'||!bases.has(id)));
  return stage&&deck;
 }).map(c=>String(c.baseId)));
}
export function collapsedDeckEntries(entries,cards){
 const byId=new Map(cards.map(c=>[c.id,c])),groups=new Map();
 for(const e of entries){const c=byId.get(e.cardId);if(!c)continue;const g=groups.get(c.baseId);if(!g)groups.set(c.baseId,{...e});else{g.amount+=e.amount;if((c.price||0)>(byId.get(g.cardId)?.price||0))g.cardId=e.cardId;}}
 return [...groups.values()];
}
