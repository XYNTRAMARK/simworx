/* Six-digit local convenience gate for the complete OFFLINE application.
 * This is NOT an authentication service and does NOT encrypt private workspace files.
 * The stored verifier is extractable from public client-side source: use OS/file security.
 * Previous local username/password credentials and all project data remain untouched.
 */
const SESSION_KEY='simworx-project-hub-pin-session-v1';
const PIN_CONFIG={
 version:1,
 salt:'f76bb20f3f607494a68f6301ab747964',
 verifier:'94e66b20259c138e8cd8914a8c61a2b85bd3c216daf4cc3fe2eb9eaeee5c521c'
};
const digits=pin=>/^[0-9]{6}$/.test(String(pin??''));
const toHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function derive(pin,saltHex){
 if(typeof crypto==='undefined'||!crypto.subtle)throw Error('This browser does not support PIN verification');
 const salt=new Uint8Array(saltHex.match(/../g).map(x=>parseInt(x,16)));
 const input=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},input,256);
 return toHex(new Uint8Array(bits));
}
export function localStaffStatus(){
 return {configured:true,unlocked:sessionStorage.getItem(SESSION_KEY)==='unlocked',secure:false,mode:'pin'};
}
export function createLocalStaffGate(){
 return {
  status:localStaffStatus,
  async signIn(pin){
   const supplied=String(pin??'').trim();
   if(!digits(supplied))throw Error('Enter exactly six digits');
   const verifier=await derive(supplied,PIN_CONFIG.salt);
   if(verifier!==PIN_CONFIG.verifier){
    sessionStorage.removeItem(SESSION_KEY);
    throw Error('Incorrect six-digit code');
   }
   sessionStorage.setItem(SESSION_KEY,'unlocked');
   return localStaffStatus();
  },
  logout(){sessionStorage.removeItem(SESSION_KEY);return localStaffStatus();}
 };
}
