import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalize,validateDraft,reconcile,exportDeck,signature,validateCover,validateRecord} from './lib/model.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)), data=process.env.TCG_DATA_DIR||path.join(root,'data');
const saveDir=process.env.TCG_SAVE_DIR||path.join(os.homedir(),'AppData/LocalLow/OPNeonGames/Card Shop Simulator');
let port=Number(process.env.PORT||4317);const host='127.0.0.1';
await fs.mkdir(data,{recursive:true});
const catalog=JSON.parse(await fs.readFile(path.join(data,'catalog.json'),'utf8'));
let state=null,activeFile='savedGames_Release0.json',drafts=[],snapshots=[],deckCovers={};
try{deckCovers=JSON.parse(await fs.readFile(path.join(data,'deck-covers.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
try{drafts=JSON.parse(await fs.readFile(path.join(data,'drafts.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
try{snapshots=JSON.parse(await fs.readFile(path.join(data,'snapshots.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
async function atomic(name,value){const dest=path.join(data,name),temp=dest+'.tmp';await fs.writeFile(temp,JSON.stringify(value));await fs.rename(temp,dest);}
async function saves(){return (await fs.readdir(saveDir)).filter(n=>/^savedGames_Release(?:\d+|BackupFile\d+)\.json$/.test(n)).map(n=>({name:n,label:n.includes('Backup')?n:`Save ${n.match(/\d+/)[0]}${n.includes('Release0.')?' · autosave':''}`}));}
async function sync(file=activeFile,record=false){
 if(!(await saves()).some(s=>s.name===file))throw Error('Select an available save file.');
 const src=path.join(saveDir,file);let parsed,stat;
 for(let i=0;i<3;i++){try{const before=await fs.stat(src);parsed=JSON.parse(await fs.readFile(src,'utf8'));stat=await fs.stat(src);if(before.mtimeMs!==stat.mtimeMs||before.size!==stat.size)throw Error('Save is being written.');break;}catch(e){if(i===2)throw e;await new Promise(r=>setTimeout(r,200));}}
 const next=normalize(parsed,catalog);next.saveFile=file;next.modified=stat.mtime.toISOString();next.synced=new Date().toISOString();
 const profile=file; // Drafts are scoped to the selected save slot.
 const selected=drafts.filter(d=>d.profile===profile), updated=reconcile(selected,next.decks);
 drafts=drafts.filter(d=>d.profile!==profile).concat(updated);await atomic('drafts.json',drafts);
 const hash=crypto.createHash('sha256').update(JSON.stringify([next.cards.map(c=>[c.owned,c.price,c.value]),next.permanentReport.duelWinCount??null])).digest('hex');
 if(record||!snapshots.some(s=>s.valuationVersion===3&&s.file===file&&s.hash===hash&&s.day===next.day&&(s.gameMinute??null)===next.gameMinute&&s.duelWins===(next.permanentReport.duelWinCount??null))){
  snapshots.push({valuationVersion:3,file,hash,day:next.day,gameMinute:next.gameMinute,at:next.synced,duelWins:next.permanentReport.duelWinCount??null,value:next.cards.reduce((n,c)=>n+c.value,0),copies:next.cards.reduce((n,c)=>n+c.owned,0)});await atomic('snapshots.json',snapshots);
 }
 activeFile=file;state=next;return payload();
}
function withCover(d){const backup=d.source==='game'?drafts.find(x=>x.profile===activeFile&&x.gameId===d.id):d;return {...d,record:backup?.record||{wins:0,losses:0},coverCardIds:deckCovers[activeFile+'|'+signature(d.entries)]||d.coverCardIds||[]};}
function nextGameSignature(sig){return state.decks.some(g=>signature(g.entries)===sig);}
function payload(){return {...state,decks:state.decks.map(withCover),drafts:drafts.filter(d=>d.profile===activeFile).map(withCover),snapshots:snapshots.filter(s=>s.file===activeFile&&s.valuationVersion===3),catalogSource:catalog.source};}
try{const available=await saves();await sync(available.some(s=>s.name===activeFile)?activeFile:available[0]?.name);}catch(e){console.error('Initial sync:',e.message);}
async function body(req){let result='';for await(const chunk of req){result+=chunk;if(result.length>1e6)throw Error('Request is too large.');}return JSON.parse(result||'{}');}
const types={'.ttf':'font/ttf','.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml'};
let mutations=Promise.resolve();
async function mutate(fn){const job=mutations.then(fn);mutations=job.catch(()=>{});return job;}
const server=http.createServer(async(req,res)=>{
 const send=(obj,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
 try{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return send({error:'Invalid host'},403);
  if(req.method!=='GET'&&req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return send({error:'Invalid origin'},403);
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/saves')return send({saves:await saves(),activeFile});
  if(url.pathname==='/api/state'&&req.method==='GET'){if(!state)return send({error:'No save loaded. Choose a save and sync.'},503);return send(payload());}
  if(url.pathname==='/api/sync-preview'&&req.method==='POST'){const b=await body(req),file=b.file||activeFile;if(!(await saves()).some(s=>s.name===file))throw Error('Select an available save file.');const next=normalize(JSON.parse(await fs.readFile(path.join(saveDir,file),'utf8')),catalog),local=drafts.filter(d=>d.profile===file),updated=reconcile(local,next.decks);return send({detached:updated.filter(d=>d.status!=='in-game'&&local.find(x=>x.id===d.id)?.status==='in-game').map(d=>({name:d.name,record:d.record||{wins:0,losses:0}}))});}
  if(url.pathname==='/api/sync'&&req.method==='POST'){const b=await body(req);return send(await mutate(()=>sync(b.file,b.record===true)));}
  if(url.pathname==='/api/deck-covers'&&req.method==='POST'){const b=await body(req);return send(await mutate(async()=>{
   const d=state.decks.find(d=>d.id===b.deckId)||drafts.find(d=>d.id===b.deckId&&d.profile===activeFile);if(!d)throw Error('Deck not found.');
   deckCovers[activeFile+'|'+signature(d.entries)]=validateCover(b.cardIds,d.entries);await atomic('deck-covers.json',deckCovers);return payload();
  }));}
  if(url.pathname==='/api/drafts'&&req.method==='POST'){const b=await body(req);return send(await mutate(async()=>{if(!state)throw Error('Sync a save first.');const d=validateDraft(b,state.cards);let old=drafts.find(d=>d.id===b.id&&d.profile===activeFile);const record=validateRecord(b.record??old?.record),candidate=typeof b.replacementSignature==='string'&&nextGameSignature(b.replacementSignature)?b.replacementSignature:null;const draft={...old,...d,record,replacementName:state.decks.find(g=>signature(g.entries)===candidate)?.name||old?.replacementName||null,replacementSignature:b.replacementSignature===null?null:candidate||old?.replacementSignature||null,id:old?.id||crypto.randomUUID(),profile:activeFile,updated:new Date().toISOString(),exportedAt:null,wasInGame:false};drafts=drafts.filter(d=>d.id!==draft.id);drafts.push(draft);if(b.coverCardIds){deckCovers[activeFile+'|'+signature(d.entries)]=d.coverCardIds;await atomic('deck-covers.json',deckCovers);}drafts=drafts.filter(d=>d.profile!==activeFile).concat(reconcile(drafts.filter(d=>d.profile===activeFile),state.decks));await atomic('drafts.json',drafts);return payload();}));}
  if(url.pathname==='/api/deck-record'&&req.method==='POST'){const b=await body(req);return send(await mutate(async()=>{
   const record=validateRecord(b.record);let draft=drafts.find(d=>d.profile===activeFile&&d.id===b.deckId);const game=state.decks.find(d=>d.id===b.deckId);
   if(!draft&&game){draft=drafts.find(d=>d.profile===activeFile&&d.gameId===game.id);if(!draft){draft={id:crypto.randomUUID(),profile:activeFile,name:game.name,entries:game.entries,coverCardIds:withCover(game).coverCardIds,record:{wins:0,losses:0}};drafts.push(draft);}}
   if(!draft)throw Error('Deck not found.');draft.record=record;draft.updated=new Date().toISOString();drafts=drafts.filter(d=>d.profile!==activeFile).concat(reconcile(drafts.filter(d=>d.profile===activeFile),state.decks));await atomic('drafts.json',drafts);return payload();
  }));}
  const match=url.pathname.match(/^\/api\/drafts\/([\w-]+)(\/export)?$/);
  if(match){return send(await mutate(async()=>{const d=drafts.find(d=>d.id===match[1]&&d.profile===activeFile);if(!d)throw Error('Draft not found.');if(req.method==='DELETE'&&!match[2]){drafts=drafts.filter(x=>x.id!==d.id);await atomic('drafts.json',drafts);return payload();}if(req.method==='POST'&&match[2]){const text=exportDeck(d,state.cards);d.exportedAt=new Date().toISOString();d.status=d.status==='in-game'?'in-game':'exported';await atomic('drafts.json',drafts);return {text};}throw Error('Unsupported operation');}));}
  if(req.method!=='GET')return send({error:'Not found'},404);
  if(['/lib/model.mjs','/lib/analytics.mjs','/lib/valuation.mjs'].includes(url.pathname)){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-cache'});return res.end(await fs.readFile(path.join(root,url.pathname.slice(1))));}
  const externalAssets=url.pathname.startsWith('/assets/')&&process.env.TCG_ASSET_DIR;
  const publicRoot=externalAssets?path.resolve(process.env.TCG_ASSET_DIR):path.join(root,'public'),file=path.resolve(publicRoot,'.'+decodeURIComponent(externalAssets?url.pathname.slice('/assets'.length):url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(publicRoot+path.sep))return send({error:'Not found'},404);
  try{const buf=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':file.includes(path.sep+'assets'+path.sep)?'public, max-age=86400':'no-cache'});res.end(buf);}catch(e){if(e.code==='ENOENT')return send({error:'Not found'},404);throw e;}
 }catch(e){send({error:e.message},400);}
});
server.listen(port,host,()=>{port=server.address().port;console.log(`Card Vault ready at http://${host}:${port}`);});
