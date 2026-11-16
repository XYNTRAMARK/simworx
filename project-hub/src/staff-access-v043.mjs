/* Local staff gate for an OFFLINE application.
 * This is a convenience lock, NOT server-authentication or confidentiality protection.
 * Browser data are not encrypted. Do not treat the gate as secure multi-user access. */
const CONFIG_KEY='simworx-project-hub-local-staff-v1';
const SESSION_KEY='simworx-project-hub-session-v1';
const encode=buf=>Array.from(new Uint8Array(buf),v=>v.toString(16).padStart(2,'0')).join('');
async function derive(password,saltHex){
 const salt=new Uint8Array(saltHex.match(/../g).map(x=>parseInt(x,16)));
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const hash=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,256);
 return encode(hash);
}
const getCfg=()=>{
 try {const v=JSON.parse(localStorage.getItem(CONFIG_KEY));
  if(v?.version===1&&typeof v.username==='string'&&/^[a-f0-9]{32}$/.test(v.salt)&&/^[a-f0-9]{64}$/.test(v.verifier))return v;
 }catch{}return null;
};
export function localStaffStatus(){
 const cfg=getCfg();
 const unlocked=!!cfg&&sessionStorage.getItem(SESSION_KEY)==='unlocked';
 return {configured:!!cfg,unlocked,username:cfg?.username||'',secure:false};
}
export function createLocalStaffGate(){
 return {
  status:localStaffStatus,
  async setup(username,password,confirmation){
   if(getCfg())throw Error('A local staff sign-in already exists. Use Sign in.');
   if(!crypto?.subtle||!crypto?.getRandomValues)throw Error('This browser does not support the local password verifier');
   const name=String(username||'').trim();
   if(name.length<3||name.length>80)throw Error('Username must be 3–80 characters');
   if(String(password||'').length<12)throw Error('Use a password of at least 12 characters');
   if(password!==confirmation)throw Error('Passwords do not match');
   const salt=crypto.getRandomValues(new Uint8Array(16));
   const cfg={version:1,username:name,salt:encode(salt),verifier:await derive(password,encode(salt))};
   localStorage.setItem(CONFIG_KEY,JSON.stringify(cfg));
   sessionStorage.setItem(SESSION_KEY,'unlocked');
   return localStaffStatus();
  },
  async signIn(username,password){
   const cfg=getCfg();if(!cfg)throw Error('Set up staff access first');
   const verifier=await derive(String(password||''),cfg.salt);
   if(cfg.username!==String(username||'').trim()||verifier!==cfg.verifier){
     sessionStorage.removeItem(SESSION_KEY);throw Error('Incorrect username or password');
   }
   sessionStorage.setItem(SESSION_KEY,'unlocked');return localStaffStatus();
  },
  logout(){sessionStorage.removeItem(SESSION_KEY);return localStaffStatus();}
 };
}
