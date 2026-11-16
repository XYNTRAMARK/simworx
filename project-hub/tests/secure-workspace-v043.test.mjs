import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createLocalWorkspaceManager} from '../src/secure-workspace-v043.mjs';
import {seed} from '../src/demo-data.mjs';
import {ensureManufacturing} from '../src/manufacturing.mjs';
import {ensureMaterials} from '../src/materials-v041.mjs';
import {ensureProgress,saveProgressStep} from '../src/progress-v043.mjs';
import {ensureExternalWork,createExternalRoute} from '../src/external-work-v043.mjs';

const dbEntries=new Map();
globalThis.crypto=webcrypto;
globalThis.localStorage={getItem:k=>k==='simworx-project-hub-demo-v1'?'{"version":1}':null};
globalThis.window={};
globalThis.indexedDB={
 open(){
  const req={result:null,error:null};
  setTimeout(()=>{
   const store={
    get(key){const r={result:null};setTimeout(()=>{r.result=dbEntries.get(key)??null;r.onsuccess?.()},0);return r},
    put(value,key){dbEntries.set(key,value);return {}}
   };
   const db={objectStoreNames:{contains:()=>true},
     transaction(type,mode){const tx={objectStore:()=>store};if(mode==='readwrite')setTimeout(()=>tx.oncomplete?.(),0);return tx}};
   req.result=db;req.onsuccess?.();
  },0);
  return req;
 }
};
const fresh=()=>{const s=seed();ensureManufacturing(s);ensureMaterials(s);ensureProgress(s);ensureExternalWork(s);return s};
test('single-device staff setup encrypts data, survives sign-out and can recover with password',async()=>{
 dbEntries.clear();
 const manager=createLocalWorkspaceManager();
 const state=fresh(),snapshot=JSON.stringify(state);
 assert.equal((await manager.initialize()).exists,false);
 await manager.createAccount({username:'workshop-admin',password:'WorkshopTestingPassphrase2026',state});
 assert.equal(manager.status().signedIn,true);
 const stored=dbEntries.get('workspace'),raw=JSON.stringify(stored);
 assert.equal(stored.format,'simworx-project-hub-encrypted-v1');
 assert.equal(raw.includes('NOAH — Advanced Training Simulator'),false);
 assert.equal(raw.includes('SW-26041'),false);
 await assert.rejects(manager.signIn({username:'workshop-admin',password:'wrong-password'}),/Incorrect/);
 manager.signOut();
 assert.equal(manager.status().signedIn,false);
 const afterSignIn=await manager.signIn({username:'workshop-admin',password:'WorkshopTestingPassphrase2026'});
 assert.equal(JSON.stringify(afterSignIn),snapshot);
});
test('autosaves manual progress and supplier handoffs without putting plain records into IndexedDB',async()=>{
 const manager=createLocalWorkspaceManager();
 await manager.initialize();
 const state=await manager.signIn({username:'workshop-admin',password:'WorkshopTestingPassphrase2026'});
 saveProgressStep(state,{projectId:'p1',title:'A real assembly stage',weight:10,completion:40});
 createExternalRoute(state,{projectId:'p1',title:'Private supplier handoff',quantity:1});
 await manager.save(state);
 const blob=JSON.stringify(dbEntries.get('workspace'));
 assert.equal(blob.includes('Private supplier handoff'),false);
 manager.signOut();
 const other=createLocalWorkspaceManager();await other.initialize();
 const read=await other.signIn({username:'workshop-admin',password:'WorkshopTestingPassphrase2026'});
 assert.equal(read.projectProgressSteps.at(-1).title,'A real assembly stage');
 assert.equal(read.externalWorkRoutes.at(-1).title,'Private supplier handoff');
});
test('optional file mirror is encrypted and can be reopened using its password',async()=>{
 const manager=createLocalWorkspaceManager();await manager.initialize();
 const state=await manager.signIn({username:'workshop-admin',password:'WorkshopTestingPassphrase2026'});
 let file='';
 const handle={queryPermission:async()=> 'granted',
  requestPermission:async()=> 'granted',createWritable:async()=>({write:async text=>{file=String(text)},close:async()=>{}})};
 window.showSaveFilePicker=async()=>handle;
 await manager.connectFile(state);
 assert.equal(manager.status().fileConnected,true);
 assert.equal(manager.status().lastFileSaved!=='' ,true);
 assert.equal(file.includes('Private supplier handoff'),false);
 const exported=await manager.encryptedBackup();
 assert.equal(exported.name.endsWith('.swphub'),true);
 const reopened=createLocalWorkspaceManager();await reopened.initialize();
 const imported=await reopened.importEncryptedFile({size:exported.text.length,text:async()=>exported.text},
  {username:'workshop-admin',password:'WorkshopTestingPassphrase2026'});
 assert.equal(imported.externalWorkRoutes.at(-1).title,'Private supplier handoff');
});
test('password below minimum is rejected on a fresh setup without creating workspace',async()=>{
 dbEntries.clear();const manager=createLocalWorkspaceManager();await manager.initialize();
 await assert.rejects(manager.createAccount({username:'admin123',password:'short',state:fresh()}),/at least 12/);
 assert.equal(dbEntries.has('workspace'),false);
});
