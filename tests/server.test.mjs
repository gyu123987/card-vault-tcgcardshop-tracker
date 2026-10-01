import test from 'node:test';
import {signature as signatureForTest} from '../lib/model.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('HTTP integration: disk persistence, sync transitions, read-only saves, and origin protection',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'card-vault-test-')),port=14317;
 const sets=[{id:'Tetramon',suffix:'',expansion:0,monsterOrder:[1]}],cards=[{id:'Tetramon:0',setId:'Tetramon',baseId:'1',monsterId:1,expansion:0,saveIndex:0,name:'Pigni'}];
 await fs.writeFile(path.join(dir,'catalog.json'),JSON.stringify({sets,cards}));
 const savePath=path.join(dir,'savedGames_Release0.json'),save={m_CardCollectedList:[10],m_CurrentDay:1,m_DeckCompactCardDataList:[]};
 const original=JSON.stringify(save);await fs.writeFile(savePath,original);
 let child;
 async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),TCG_SAVE_DIR:dir,TCG_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',b=>error+=b);await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Startup timed out: '+error)),10000);child.stdout.on('data',b=>{if(String(b).includes('ready')){clearTimeout(timeout);resolve();}});child.on('exit',code=>{clearTimeout(timeout);reject(Error('Server exited '+code+' '+error));});});}
 async function stop(){if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}}
 async function api(route,method='GET',body){const r=await fetch(`http://127.0.0.1:${port}/api${route}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,200,JSON.stringify(json));return json;}
 try{
  await start();let s=await api('/drafts','POST',{name:'Integration test',entries:[{cardId:'Tetramon:0',amount:4}]});const id=s.drafts[0].id;
  assert.equal((await api('/drafts/'+id+'/export','POST')).text,'4X Pigni Tetramon N 001');assert.equal((await api('/state')).drafts[0].status,'exported');
  s=await api('/deck-covers','POST',{deckId:id,cardIds:['Tetramon:0']});assert.deepEqual(s.drafts[0].coverCardIds,['Tetramon:0']);assert.equal(s.drafts[0].status,'exported');
  const invalidCover=await fetch(`http://127.0.0.1:${port}/api/deck-covers`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deckId:id,cardIds:['unknown']})});assert.equal(invalidCover.status,400);
  assert.equal(await fs.readFile(savePath,'utf8'),original);
  await stop();await start();assert.equal((await api('/state')).drafts[0].id,id);assert.deepEqual((await api('/state')).drafts[0].coverCardIds,['Tetramon:0']);
  save.m_CardCollectedList=[6];save.m_DeckCompactCardDataList=[{deckName:'Imported',compactCardDataAmountList:[{expansionType:0,cardSaveIndex:0,amount:4}]}];await fs.writeFile(savePath,JSON.stringify(save));
  s=await api('/sync','POST',{});assert.equal(s.drafts[0].status,'in-game');assert.equal(s.cards[0].owned,10);assert.equal(s.cards[0].available,6);assert.deepEqual(s.decks[0].coverCardIds,['Tetramon:0']);
  s=await api('/deck-covers','POST',{deckId:s.decks[0].id,cardIds:[]});assert.equal(s.drafts.length,1);assert.deepEqual(s.decks[0].coverCardIds,[]);
  save.m_CardCollectedList=[10];save.m_DeckCompactCardDataList=[];await fs.writeFile(savePath,JSON.stringify(save));s=await api('/sync','POST',{});assert.equal(s.drafts[0].status,'draft');assert.equal(s.cards[0].owned,10);
  const beforeWins=s.snapshots.length;save.m_GameReportDataCollectPermanent={duelWinCount:1};await fs.writeFile(savePath,JSON.stringify(save));s=await api('/sync','POST',{});assert.equal(s.snapshots.at(-1).duelWins,1);assert.equal(s.snapshots.length,beforeWins+1);s=await api('/sync','POST',{});assert.equal(s.snapshots.length,beforeWins+1);save.m_GameReportDataCollectPermanent.duelWinCount=2;await fs.writeFile(savePath,JSON.stringify(save));s=await api('/sync','POST',{});assert.equal(s.snapshots.at(-1).duelWins,2);assert.equal(s.snapshots.length,beforeWins+2);
  const beforeClock=s.snapshots.length;save.m_LightTimeData={m_TimeHour:11,m_TimeMin:15};await fs.writeFile(savePath,JSON.stringify(save));s=await api('/sync','POST',{});assert.equal(s.gameMinute,675);assert.equal(s.snapshots.at(-1).gameMinute,675);assert.equal(s.snapshots.length,beforeClock+1);s=await api('/sync','POST',{});assert.equal(s.snapshots.length,beforeClock+1);
  save.m_LightTimeData.m_TimeMin=30;await fs.writeFile(savePath,JSON.stringify(save));s=await api('/sync','POST',{});assert.equal(s.snapshots.length,beforeClock+2);assert.equal(s.snapshots.at(-1).gameMinute,690);assert.equal(await fs.readFile(savePath,'utf8'),JSON.stringify(save));
  const beforeManual=s.snapshots.length;s=await api('/sync','POST',{record:true});assert.equal(s.snapshots.length,beforeManual+1);assert.equal(s.snapshots.at(-1).gameMinute,690);s=await api('/sync','POST',{record:true});assert.equal(s.snapshots.length,beforeManual+2);
  s=await api('/deck-record','POST',{deckId:id,record:{wins:9,losses:4}});assert.deepEqual(s.drafts.find(d=>d.id===id).record,{wins:9,losses:4});
  save.m_CardCollectedList=[6];save.m_DeckCompactCardDataList=[{deckName:'Renamed',compactCardDataAmountList:[{expansionType:0,cardSaveIndex:0,amount:4}]}];await fs.writeFile(savePath,JSON.stringify(save));s=await api('/sync','POST',{});assert.deepEqual(s.decks[0].record,{wins:9,losses:4});
  save.m_DeckCompactCardDataList[0].compactCardDataAmountList[0].amount=3;await fs.writeFile(savePath,JSON.stringify(save));const preview=await api('/sync-preview','POST',{});assert.equal(preview.detached.length,1);assert.equal((await api('/state')).drafts.find(d=>d.id===id).status,'in-game');s=await api('/sync','POST',{});assert.equal(s.drafts.find(d=>d.id===id).status,'draft');assert.deepEqual(s.decks[0].record,{wins:0,losses:0});assert.deepEqual(s.drafts.find(d=>d.id===id).record,{wins:9,losses:4});
  s=await api('/drafts','POST',{id,name:'Edited local',entries:[{cardId:'Tetramon:0',amount:2}],record:{wins:9,losses:4},replacementSignature:signatureForTest(s.decks[0].entries)});assert.deepEqual(s.drafts.find(d=>d.id===id).record,{wins:9,losses:4});assert.equal(s.drafts.find(d=>d.id===id).status,'draft');assert.ok(s.drafts.find(d=>d.id===id).replacementName);
  await stop();await start();assert.deepEqual((await api('/state')).drafts.find(d=>d.id===id).record,{wins:9,losses:4});
  const bad=await fetch(`http://127.0.0.1:${port}/api/sync`,{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'});assert.equal(bad.status,403);
  const traversal=await fetch(`http://127.0.0.1:${port}/api/sync`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:'../catalog.json'})});assert.equal(traversal.status,400);
  s=await api('/drafts/'+id,'DELETE');assert.equal(s.drafts.length,0);
 }finally{
  await stop();
  // Only remove the exact newly-created test directory inside the OS temp folder.
  const resolved=path.resolve(dir),parent=path.resolve(os.tmpdir());
  if(path.dirname(resolved)===parent&&path.basename(resolved).startsWith('card-vault-test-'))await fs.rm(resolved,{recursive:true,force:true});
 }
});
