// Rules recovered from the installed game's CardOpeningSequence methods.
// Integer Random.Range is upper-exclusive; branch order matters at roll 1130.
export function specialPackIndex(roll) {
 if(roll===1000)return 12;
 for(const [lo,hi,index] of [[1001,1051,11],[1052,1060,10],[1061,1081,9],[1082,1130,8],[1130,1230,7],[1240,1360,6],[1370,1570,13],[1580,1650,5],[1660,1860,4],[1870,2120,3],[2130,2440,2],[2450,2950,1]])if(roll>=lo&&roll<=hi)return index;
 return 0;
}
const counts=Array(14).fill(0);
for(let roll=0;roll<100000;roll++)counts[specialPackIndex(roll)]++;
export const SPECIAL_PACK_COUNTS=Object.freeze(counts);
export function packOdds(expansion=0,level=2){
 if(![0,1,7].includes(expansion))throw new Error('Select Tetramon, Destiny or Ascension.');
 const weights=counts.map((n,i)=>level>1?n/100000:Number(i===0)),ghostRoll=level>1?(expansion===0?.001:.002):0;
 const names=expansion===7?['Base','Silver','Gold','Silver Full Art','EX Full Art','Full Art']:['Base','First Edition','Silver','Gold','EX','Full Art'];
 const borders=Array(6).fill(0);let remaining=1;
 for(const [border,p] of [[5,.0025],[4,.01],[3,.04],[2,.08],[1,.2]]){borders[border]=remaining*p;remaining*=1-p;}borders[0]=remaining;
 const variants=borders.flatMap((p,border)=>[false,true].map(foil=>{
  const normalCard=p*(foil?.05:.95),special=foil?(border===0?13:border+5):border;
  const forced=border===0&&!foil?0:weights[special];
  // A regular Ghost replaces slot seven; Ghost special packs replace all seven.
  const pack=weights[0]*((1-ghostRoll)*(1-(1-normalCard)**7)+ghostRoll*(1-(1-normalCard)**6))+forced;
  return {border,foil,name:names[border],normalCard,pack};
 }));
 const foilSpecial=[6,7,8,9,10,13].reduce((s,i)=>s+weights[i],0),nonfoilSpecial=[1,2,3,4,5].reduce((s,i)=>s+weights[i],0);
 const singleFoil=ghostRoll*(weights[0]*.05+foilSpecial),singleNonfoil=ghostRoll*(weights[0]*.95+nonfoilSpecial);
 const ghosts=[false,true].flatMap(foil=>['White','Black'].map(color=>({color,foil,pack:(foil?singleFoil:singleNonfoil)/2+weights[foil?12:11]*(1-.5**7)})));
 return {variants,ghosts,ghostRoll,ghostPack:weights[11]+weights[12]+singleFoil+singleNonfoil,ghostFoilPack:weights[12]+singleFoil,allGhost:weights[11]+weights[12],allGhostFoil:weights[12],specialPack:1-weights[0],weights};
}
export function savedGameMinute(save){
 const clock=save?.m_LightTimeData,h=clock?.m_TimeHour,m=clock?.m_TimeMin;
 return Number.isInteger(h)&&h>=0&&h<24&&Number.isInteger(m)&&m>=0&&m<60?h*60+m:null;
}
export function snapshotSeries(snapshots,key){
 return snapshots.flatMap((s,index)=>{
  if(!Number.isFinite(s.day)||!Number.isFinite(s[key]))return [];
  const timed=Number.isInteger(s.gameMinute)&&s.gameMinute>=0&&s.gameMinute<1440;
  return [{value:s[key],x:s.day+(timed?s.gameMinute/1440:0),at:s.at,index,label:`Day ${s.day} · ${timed?`${String(Math.floor(s.gameMinute/60)).padStart(2,'0')}:${String(s.gameMinute%60).padStart(2,'0')} in game`:'in-game time unavailable'} · Sync ${index+1}${s.at?' · '+new Date(s.at).toLocaleString():''}`}];
 }).sort((a,b)=>a.x-b.x||String(a.at).localeCompare(String(b.at))||a.index-b.index);
}
export function recentSyncRange(points,width=520){
 if(!points.length)return [0,1];
 const count=Math.max(8,Math.min(30,Math.floor(width/26))),last=points.at(-1).x;
 let start=Math.max(0,points.length-count);
 const gaps=points.slice(start+1).map((p,i)=>p.x-points[start+i].x).filter(g=>g>0).sort((a,b)=>a-b),typical=gaps[Math.floor(gaps.length/2)];
 if(typical)for(let i=points.length-4;i>start;i--)if(points[i].x-points[i-1].x>typical*8){start=i;break;}
 // Keep a dense recent cluster together instead of splitting coincident points.
 while(start>0&&points[start-1].x===points[start].x)start--;
 return [points[start].x,last];
}
// Average product of per-monster miss probabilities when drawing distinct monsters.
export function missProbability(misses,draws,duplicates){
 if(!misses.length)return 1;
 if(duplicates)return (misses.reduce((s,p)=>s+p,0)/misses.length)**draws;
 draws=Math.min(draws,misses.length);const dp=Array(draws+1).fill(0);dp[0]=1;
 for(let i=0;i<misses.length;i++)for(let k=Math.min(draws,i+1);k>0;k--)dp[k]=dp[k]*(i+1-k)/(i+1)+dp[k-1]*misses[i]*k/(i+1);
 return dp[draws];
}
export function independentCompletionMean(probabilities,needs=probabilities.map(()=>1)){
 if(!probabilities.length)return 0;
 if(probabilities.some(p=>p<=0))return Infinity;
 if(probabilities.length===1)return needs[0]/probabilities[0];
 // Continuous geometric approximation with a half-step correction.
 const rates=probabilities.map(p=>-Math.log1p(-Math.min(p,1-1e-15))),limit=(32+Math.max(...needs)*2)/Math.min(...rates),steps=1024;
 let total=0,prevT=0,prevS=1;
 for(let i=0;i<=steps;i++){
  const t=Math.exp(Math.log(1e-6)+(Math.log(limit)-Math.log(1e-6))*i/steps);
  const logCDF=rates.reduce((sum,r,j)=>{const x=r*t;let term=Math.exp(-x),tail=term;for(let k=1;k<needs[j];k++){term*=x/k;tail+=term;}return sum+Math.log(Math.max(0,1-tail));},0),survival=-Math.expm1(logCDF);
  total+=(t-prevT)*(survival+prevS)/2;prevT=t;prevS=survival;
 }
 return total+.5;
}
export function collectionForecast(cards,setId,isComplete,level=2,ghostSource=1,rarity=null,copiesNeeded=null){
 const needed=c=>copiesNeeded?Math.max(0,Math.ceil(copiesNeeded(c))):Number(!isComplete(c));
 const target=cards.filter(c=>c.setId===setId&&(!rarity||c.rarity===rarity)),missing=target.filter(c=>needed(c)>0);
 if(!missing.length)return {missing:0,next:0,complete:0,chance:0};
 const expansion=target[0]?.expansion,ghost=expansion===2,odds=packOdds(ghost?ghostSource:expansion,level),w=odds.weights,g=odds.ghostRoll;
 const pools=ghost||expansion===7?[target]:['Common','Rare','Epic','Legendary'].map(r=>target.filter(c=>c.rarity===r)).filter(p=>p.length);
 let chance=0;const probabilities=[],needs=[];
 for(const pool of pools){
  const ids=[...new Set(pool.map(c=>c.baseId))],n=ids.length,duplicates=ghost||expansion===7,poolMissing=pool.filter(c=>needed(c)>0);
  if(ghost){
   const foilWeight=[6,7,8,9,10,13].reduce((s,i)=>s+w[i],0),nonfoilWeight=[1,2,3,4,5].reduce((s,i)=>s+w[i],0);
   for(const foil of [false,true]){
    const count=poolMissing.filter(c=>!!c.foil===foil).length,single=g*(w[0]*(foil?.05:.95)+(foil?foilWeight:nonfoilWeight)),special=w[foil?12:11];
    chance+=single*count/(2*n)+special*(1-(1-count/(2*n))**7);
    for(const c of poolMissing.filter(c=>!!c.foil===foil)){probabilities.push(single/(2*n)+special*(1-(1-1/(2*n))**7));needs.push(needed(c));}
   }
  }else{
   const variantP=new Map(odds.variants.map(v=>[`${v.border}:${v.foil}`,v.normalCard]));
   const misses=ids.map(id=>1-poolMissing.filter(c=>c.baseId===id).reduce((sum,c)=>sum+variantP.get(`${c.border}:${!!c.foil}`),0));
   let hit=w[0]*(1-(1-g)*missProbability(misses,7,duplicates)-g*missProbability(misses,6,duplicates));
   for(const v of odds.variants){
    const forced=v.foil?(v.border===0?13:v.border+5):v.border,weight=!v.foil&&v.border===0?0:w[forced];
    const subset=poolMissing.filter(c=>c.border===v.border&&!!c.foil===v.foil),missingIds=new Set(subset.map(c=>c.baseId));
    const no=ids.map(id=>missingIds.has(id)?0:1);
    hit+=weight*(1-(1-g)*missProbability(no,7,duplicates)-g*missProbability(no,6,duplicates));
    const normal=duplicates?(1-g)*(1-(1-v.normalCard/n)**7)+g*(1-(1-v.normalCard/n)**6):v.normalCard*(7-g)/n;
    const forcedHit=duplicates?(1-g)*(1-(1-1/n)**7)+g*(1-(1-1/n)**6):(7-g)/n;
    for(const c of subset){probabilities.push((w[0]*normal+weight*forcedHit)/pools.length);needs.push(needed(c));}
   }
   chance+=hit/pools.length;
  }
 }
 return {missing:missing.length,chance:Math.max(0,Math.min(1,chance)),next:chance>0?1/chance:Infinity,complete:independentCompletionMean(probabilities,needs),probabilities,copiesMissing:needs.reduce((a,b)=>a+b,0)};
}
