import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('HTTP sync shares a playthrough across slots, isolates replacement games, and preserves legacy records',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'vault-history-')),port=14318;
 const make=(offset,day)=>({m_CurrentDay:day,m_GenCardMarketPriceList:Array.from({length:128},(_,i)=>({generatedMarketPrice:i+1+offset})),m_CardCollectedList:[day]});
 const a=JSON.stringify(make(0,10)),b=JSON.stringify(make(0,11));
 await fs.writeFile(path.join(folder,'catalog.json'),JSON.stringify({sets:[{id:'Tetramon',expansion:0,suffix:''}],cards:[{id:'Tetramon:0',setId:'Tetramon',expansion:0,saveIndex:0,baseId:'1'}]}));
 await fs.writeFile(path.join(folder,'savedGames_Release0.json'),a);await fs.writeFile(path.join(folder,'savedGames_Release1.json'),b);
 await fs.writeFile(path.join(folder,'snapshots.json'),JSON.stringify([{file:'savedGames_Release0.json',valuationVersion:3,day:1,value:999}]));
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,TCG_DATA_DIR:folder,TCG_SAVE_DIR:folder,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),10000);child.stdout.on('data',b=>{if(String(b).includes('ready')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});
  const api=async(file)=>{const r=await fetch(`http://127.0.0.1:${port}/api/sync`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file})});assert.equal(r.status,200);return r.json();};
  let s=await api('savedGames_Release1.json');assert.deepEqual(s.snapshots.map(x=>x.day),[10,11]);const originalProfile=s.historyProfile;
  await fs.writeFile(path.join(folder,'savedGames_Release0.json'),JSON.stringify(make(100,1)));
  s=await api('savedGames_Release0.json');assert.notEqual(s.historyProfile,originalProfile);assert.deepEqual(s.snapshots.map(x=>x.day),[1]);assert.equal(s.legacySnapshotCount,1);
  s=await api('savedGames_Release1.json');assert.equal(s.historyProfile,originalProfile);assert.deepEqual(s.snapshots.map(x=>x.day),[10,11]);
  assert.equal(await fs.readFile(path.join(folder,'savedGames_Release1.json'),'utf8'),b);
  assert.ok(JSON.parse(await fs.readFile(path.join(folder,'snapshots.json'),'utf8')).some(x=>x.value===999));
 }finally{const exited=once(child,'exit');child.kill();await exited;await fs.rm(folder,{recursive:true,force:true});}
});
