/* Sim-Worx Project Hub — local staff access & encrypted workspace storage.
 * One computer/browser, not a shared server identity service.
 * Secure encrypted at rest: PBKDF2 SHA256 + AES-256-GCM, per-write random IV.
 * Encrypted IndexedDB autosave; optional encrypted user-selected file mirror.
 * Never transmit credentials or project records over a network.
 */
export function createLocalWorkspaceManager({onStatus=()=>{}}={}){
 const DB='SimWorxProjectHubWorkspaceV1', STORE='entries', RECORD='workspace', HANDLE='fileHandle';
 const FORMAT='simworx-project-hub-encrypted-v1';
 const VERSION=1, ITERATIONS=250000;
 let dbPromise=null,session=null,fileHandle=null,ready=false,exists=false,saving=false;
 let lastSaved='',lastFileSaved='',error='',fileError='',revision=0,queue=Promise.resolve();
 const notify=()=>onStatus(status());
 const textEncoder=new TextEncoder(),decoder=new TextDecoder();
 const b64=bytes=>{const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let value='';
   for(let i=0;i<data.length;i+=8192)value+=String.fromCharCode(...data.subarray(i,i+8192));
   return btoa(value);
 };
 const from64=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
 const random=n=>crypto.getRandomValues(new Uint8Array(n));
 const supported=()=>typeof crypto!=='undefined'&&!!(crypto.subtle&&globalThis.indexedDB);
 function openDB(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   if(!supported()){reject(Error('Encrypted browser storage is unavailable. Use current Chrome on a secure local page.'));return;}
   const request=indexedDB.open(DB,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||Error('Unable to open encrypted workspace storage'));
  });
  return dbPromise;
 }
 async function read(key){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);
   r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error||Error('Read failed'));
  });
 }
 async function write(key,value){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(value,key);
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Encrypted workspace write failed'));
   tx.onabort=()=>reject(tx.error||Error('Encrypted workspace transaction aborted'));
  });
 }
 const checkLogin=login=>{
  const s=String(login||'').trim();
  if(!/^[a-zA-Z0-9._-]{3,50}$/.test(s))throw Error('Username must be 3–50 characters: letters, numbers, dot, dash or underscore');
  return s;
 };
 const checkPassphrase=passphrase=>{
  if(String(passphrase||'').length<12)throw Error('Use a password of at least 12 characters');
  if(String(passphrase||'').length>256)throw Error('Password is too long');
  return String(passphrase);
 };
 async function derive(passphrase,salt,iterations){
  const base=await crypto.subtle.importKey('raw',textEncoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},base,
   {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 const checkEnvelope=x=>{
  if(x?.format!==FORMAT||x.version!==VERSION||typeof x.username!=='string'||!x.salt||!x.iv||!x.encrypted)
   throw Error('This is not a supported encrypted Project Hub workspace');
  if(x.iterations<ITERATIONS||x.iterations>2000000)throw Error('Unsupported key-derivation settings');
  return x;
 };
 async function seal(state){
  if(!session)throw Error('Please sign in before saving');
  const iv=random(12),plaintext=textEncoder.encode(JSON.stringify(state));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},session.key,plaintext);
  return {format:FORMAT,version:VERSION,username:session.username,salt:session.salt,
   iterations:session.iterations,iv:b64(iv),encrypted:b64(encrypted),savedAt:new Date().toISOString()};
 }
 async function decrypt(record,username,passphrase){
  const env=checkEnvelope(record);
  if(env.username.toLowerCase()!==String(username||'').trim().toLowerCase())throw Error('Incorrect username or password');
  try{
   const key=await derive(passphrase,from64(env.salt),env.iterations);
   const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(env.iv)},key,from64(env.encrypted));
   const state=JSON.parse(decoder.decode(plaintext));
   if(!state||state.version!==1||!Array.isArray(state.projects)||!Array.isArray(state.parts))
    throw Error('Workspace state failed validation');
   return {state,key};
  }catch{throw Error('Incorrect username, password or corrupted workspace');}
 }
 function status(){
  return {ready,exists,signedIn:!!session,username:session?.username||'',saving,
   lastSaved,lastFileSaved,error,fileError,revision,
   fileConnected:!!fileHandle,canChooseFile:typeof window.showSaveFilePicker==='function',
   legacyFound:(()=>{try{return !!localStorage.getItem('simworx-project-hub-demo-v1')}catch{return false}})()};
 }
 async function initialize(){
  try{
   const record=await read(RECORD);
   exists=!!record;
   if(record)checkEnvelope(record);
   fileHandle=await read(HANDLE);
  }catch(err){error=String(err.message||err);exists=true;}
  finally{ready=true;notify();}
  return status();
 }
 async function createAccount({username,password,state}){
  if(!ready)throw Error('Workspace storage has not initialised');
  if(exists)throw Error('An encrypted workspace already exists. Sign in or import its encrypted backup instead.');
  const user=checkLogin(username),pass=checkPassphrase(password);
  const salt=b64(random(16)),key=await derive(pass,from64(salt),ITERATIONS);
  session={username:user,key,salt,iterations:ITERATIONS};exists=true;
  try{await save(state);return state}
  catch(err){session=null;exists=!!(await read(RECORD));throw err}
 }
 async function signIn({username,password}){
  if(!ready)throw Error('Workspace storage has not initialised');
  const record=await read(RECORD);if(!record)throw Error('No encrypted workspace found in this browser');
  const result=await decrypt(record,username,password);
  session={username:record.username,key:result.key,salt:record.salt,iterations:record.iterations};
  exists=true;lastSaved=record.savedAt||'';error='';fileError='';notify();
  return result.state;
 }
 function signOut(){
  if(saving||error)throw Error('Workspace saving is incomplete. Keep this session open and export an emergency encrypted backup before signing out.');
  session=null;error='';notify();
 }
 async function save(state){
  if(!session)throw Error('Please sign in before saving');
  const snapshot=JSON.parse(JSON.stringify(state)),mine=++revision;
  saving=true;error='';notify();
  const operation=queue.catch(()=>{}).then(async()=>{
   const env=await seal(snapshot);
   await write(RECORD,env);
   exists=true;lastSaved=env.savedAt;error='';notify();
   if(fileHandle){
    try{
     let permission=typeof fileHandle.queryPermission==='function'?await fileHandle.queryPermission({mode:'readwrite'}):'prompt';
     if(permission==='granted'){
      const writable=await fileHandle.createWritable();
      await writable.write(JSON.stringify(env,null,2));await writable.close();
      lastFileSaved=env.savedAt;fileError='';
     }else fileError='File permission is required. Browser copy saved; reconnect the file from Settings.';
    }catch(err){fileError='File save failed: '+String(err.message||err);}
   }
  }).catch(err=>{error='SAVE FAILED: '+String(err.message||err);throw err;})
  .finally(()=>{if(mine===revision){saving=false;notify();}});
  queue=operation.catch(()=>{});
  return operation;
 }
 async function connectFile(state){
  if(!session)throw Error('Sign in first');
  if(typeof window.showSaveFilePicker!=='function')throw Error('Automatic file saving needs Chrome desktop with File System Access support');
  const handle=await window.showSaveFilePicker({
   suggestedName:'SimWorx_Project_Hub_Workspace.swphub',
   types:[{description:'Encrypted Sim-Worx workspace',accept:{'application/json':['.swphub']}}]});
  fileHandle=handle;await write(HANDLE,handle);
  fileError='';notify();
  await save(state);return status();
 }
 async function reconnectFile(state){
  if(!session)throw Error('Sign in first');
  if(!fileHandle)throw Error('No workspace file selected yet');
  const permission=await fileHandle.requestPermission({mode:'readwrite'});
  if(permission!=='granted')throw Error('File permission was not granted');
  await save(state);return status();
 }
 async function emergencyEncryptedBackup(state){
  if(!session)throw Error('Sign in first');
  const record=await seal(JSON.parse(JSON.stringify(state)));
  return {name:'SimWorx_Emergency_Encrypted_Backup_'+new Date().toISOString().slice(0,10)+'.swphub',
    text:JSON.stringify(record,null,2)};
 }
 async function encryptedBackup(){
  if(!session)throw Error('Sign in first');
  await queue;
  const record=await read(RECORD);
  if(!record)throw Error('No saved encrypted workspace');
  return {name:'SimWorx_Encrypted_Workspace_'+new Date().toISOString().slice(0,10)+'.swphub',
   text:JSON.stringify(record,null,2)};
 }
 async function importEncryptedFile(file,{username,password}){
  if(!file||file.size>50000000)throw Error('Encrypted backup must be at most 50 MB');
  const record=checkEnvelope(JSON.parse(await file.text()));
  const result=await decrypt(record,username,password);
  await write(RECORD,record);
  exists=true;session={username:record.username,key:result.key,salt:record.salt,iterations:record.iterations};
  lastSaved=record.savedAt||'';error='';fileError='';notify();
  return result.state;
 }
 function unsavedChanges(){return saving||!!error||!!fileError&&!!fileHandle;}
 return {initialize,status,createAccount,signIn,signOut,save,connectFile,reconnectFile,
  encryptedBackup,emergencyEncryptedBackup,importEncryptedFile,unsavedChanges};
}
