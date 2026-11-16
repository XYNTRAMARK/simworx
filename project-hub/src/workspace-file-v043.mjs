/* File-backed workspace for desktop Chromium. No network. File System Access API requires
   supported Chromium & user-selected JSON file. Browser storage remains a fallback.
   A file handle is intentionally not cached across origins; relink after opening a new HTML version. */
export function createWorkspaceFileController({onStatus=()=>{}}={}){
 let fileHandle=null,queue=Promise.resolve(),state='Browser only',lastSaved='';
 const emit=(kind,message)=>{state=kind;onStatus({kind,message,lastSaved,connected:!!fileHandle});};
 const status=()=>({kind:state,connected:!!fileHandle,lastSaved});
 const supportsFiles=()=>typeof window!=='undefined'&&
   typeof window.showSaveFilePicker==='function'&&typeof window.showOpenFilePicker==='function';
 function ensureFileAPI(){if(!supportsFiles())throw Error('Automatic file save requires current Chrome/Edge with local file permission. Use Download JSON backup in Settings if unavailable.');}
 async function writeJSON(text){
  if(!fileHandle)return false;
  try{
   const p=await fileHandle.queryPermission({mode:'readwrite'});
   if(p!=='granted'&&await fileHandle.requestPermission({mode:'readwrite'})!=='granted')throw Error('File write permission was declined');
   const writer=await fileHandle.createWritable();
   try{await writer.write(new Blob([text],{type:'application/json;charset=utf-8'}));await writer.close();}
   catch(err){try{await writer.abort()}catch{}throw err}
   lastSaved=new Date().toISOString();
   emit('file-saved','Saved to your chosen workspace file');
   return true;
  }catch(err){
   emit('file-error',String(err?.message||err));throw err;
  }
 }
 function scheduleSave(text){
  if(!fileHandle)return Promise.resolve(false);
  emit('file-saving','Saving workspace file…');
  const action=queue.catch(()=>{}).then(()=>writeJSON(text));
  queue=action;
  return action.catch(()=>false);
 }
 async function createAndConnect(text){
  ensureFileAPI();
  const selected=await window.showSaveFilePicker({suggestedName:'SimWorx_ProjectHub_Workspace.json',
   types:[{description:'Sim-Worx workspace JSON',accept:{'application/json':['.json']}}]});
  if(!selected)return false;
  await queue.catch(()=>{});
  fileHandle=selected;
  await writeJSON(text);
  return true;
 }
 async function openCandidate(){
  ensureFileAPI();
  const [selected]=await window.showOpenFilePicker({multiple:false,types:[
    {description:'Sim-Worx workspace JSON',accept:{'application/json':['.json']}}]});
  if(!selected)return null;
  const f=await selected.getFile();
  if(f.size>10000000)throw Error('Workspace JSON exceeds the 10 MB import limit');
  const text=await f.text();
  return {handle:selected,filename:f.name,text};
 }
 async function connectOpened(handle){
  if(!handle)throw Error('No workspace file was selected');
  await queue.catch(()=>{});
  fileHandle=handle;
  emit('file-connected','Workspace file connected');
 }
 function detach(){fileHandle=null;emit('browser-only','Browser-only saving');}
 return {supportsFiles,status,scheduleSave,createAndConnect,openCandidate,connectOpened,detach};
}
