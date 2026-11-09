(() => {
"use strict";
const ENDPOINT="https://euttubfvsrgkeiescsdm.supabase.co";
const PUBLISHABLE="sb_publishable_PEfCOwn6Xkwtl7RhWPAPVA_Ppgq08Wl";
const BUCKET="simworx-sign-private";
const NOI="NOAA King Air 360ER — Supply Agreement";
const sb=window.supabase.createClient(ENDPOINT,PUBLISHABLE,{auth:{flowType:"pkce",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let authorized=false, pkg=null, busy=false;
const el=id=>document.getElementById(id);
const tell=(txt,error=false)=>{const e=el("privateStatus");e.textContent=txt;e.style.color=error?"#f4b4b4":"#a9dff9"};
async function sha(bytes){const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("")}
const findDoc=role=>window.signDocs?.find(d=>d.id===role);
async function check(){
try{
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user){authorized=false;el("cloudSignIn").classList.remove("hide");el("cloudSignedIn").classList.add("hide");tell("Sign in to access private contract documents.");return}
 const {data:staff,error:se}=await sb.from("sign_staff").select("user_id").eq("user_id",user.id).maybeSingle();
 if(se||!staff){authorized=false;tell("This account is not authorised for Simworx Sign. No documents were accessed.",true);return}
 authorized=true;el("cloudSignIn").classList.add("hide");el("cloudSignedIn").classList.remove("hide");
 el("staffIdentity").textContent=user.email||"Simworx staff";await loadExisting();
}catch(e){tell("Unable to connect private storage: "+e.message,true)}
}
async function loadExisting(){
 if(!authorized)return;
 const {data:p,error:pe}=await sb.from("sign_packages").select("id,title,status").eq("title",NOI).order("created_at",{ascending:false}).limit(1);
 if(pe)throw pe;
 if(!p?.length){tell("Signed in, but the NOAA package has not been registered.",true);return}
 pkg=p[0];el("activePackage").textContent=pkg.title+" · "+pkg.status;
 const {data:items,error:de}=await sb.from("sign_documents").select("role,filename,storage_path,sha256,pages").eq("package_id",pkg.id);
 if(de)throw de;
 let count=0;
 for(const item of items||[]){
   const d=findDoc(item.role);if(!d)continue;
   try{
     const {data:blob,error:e}=await sb.storage.from(BUCKET).download(item.storage_path);
     if(e)throw e;
     const bytes=await blob.arrayBuffer();
     if(await sha(bytes)!==item.sha256)throw Error("SHA-256 mismatch");
     d.file=new File([blob],item.filename,{type:"application/pdf"});d.filename=item.filename;d.output=null;count++;
   }catch(e){tell("One stored document failed verification: "+item.filename+" — "+e.message,true)}
 }
 window.updateSignDashboard?.();
 const haveAll=['agreement','annex01','annex16'].every(role=>(items||[]).some(item=>item.role===role));
 const importer=el("packageZip")?.closest("div[style*='margin-top:16px']");
 if(importer)importer.style.display=haveAll?"none":"";
 tell(count?("✓ "+count+" verified private document"+(count>1?"s":"")+" loaded automatically. Choose Main Agreement below."):
     "Private NOAA package created. Awaiting upload of its three PDFs.");
}
async function saveRole(d){
 if(!authorized || !pkg || !d?.file)throw Error("Sign in to the private library before importing.");
 const bytes=await d.file.arrayBuffer();
 if(bytes.byteLength>50*1024*1024)throw Error(d.title+" exceeds 50 MB.");
 if(!window.PDFLib)throw Error("PDF library unavailable.");
 const pdf=await PDFLib.PDFDocument.load(bytes);
 const path=pkg.id+"/"+crypto.randomUUID()+".pdf";
 const {error:ue}=await sb.storage.from(BUCKET).upload(path,new Blob([bytes],{type:"application/pdf"}),{contentType:"application/pdf",upsert:false});
 if(ue)throw Error(d.title+": "+ue.message);
 const {error:me}=await sb.from("sign_documents").upsert({
   package_id:pkg.id,role:d.id,filename:d.file.name,storage_path:path,
   sha256:await sha(bytes),pages:pdf.getPageCount(),requires_signature:d.kind!=="attachment"
 },{onConflict:"package_id,role"});
 if(me)throw Error(d.title+" metadata: "+me.message);
 return true;
}
async function saveAll(items){
 if(busy)return {ok:false,message:"An import is already running."};
 if(!authorized || !pkg)return {ok:false,message:"Private storage is not authorised."};
 busy=true;
 let count=0;
 try{
  for(const d of items){
   tell("Saving "+d.title+" securely…");
   await saveRole(d);count++;
  }
  tell("✓ "+count+" NOAA PDF"+(count===1?"":"s")+" saved to private storage.");
  return {ok:true,count};
 }catch(e){
  const message=e instanceof Error?e.message:String(e);
  tell("Private import stopped: "+message,true);
  return {ok:false,count,message};
 }finally{busy=false}
}
window.signCloud={saveRole,saveAll,check};
el("packageZip").onchange=()=>{
 const file=el("packageZip").files[0];
 if(file)window.importPreparedZip?.(file);
};
el("sendMagicLink").onclick=async()=>{
 const email=el("cloudEmail").value.trim();if(!email)return tell("Enter your Simworx staff email.",true);
 el("sendMagicLink").disabled=true;
 try{
  const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:"https://sim-worx.com/sign/",shouldCreateUser:false}});
  if(error)throw error;tell("A secure sign-in email has been sent. Open the link in your mailbox.");
 }catch(e){tell("Sign-in failed: "+e.message,true)}
 finally{el("sendMagicLink").disabled=false}
};
el("cloudLogOut").onclick=async()=>{await sb.auth.signOut();pkg=null;authorized=false;for(const d of window.signDocs||[]){d.file=null;d.output=null;d.filename=""}window.updateSignDashboard?.();await check()};
el("cloudReload").onclick=()=>loadExisting().catch(e=>tell(e.message,true));
sb.auth.onAuthStateChange((_event,_session)=>{setTimeout(()=>check(),0)});
check();
})();