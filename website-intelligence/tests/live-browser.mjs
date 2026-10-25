// Optional live browser check. Uses only Chrome and Node's built-in CDP WebSocket.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const base=process.env.REPORTS_PUBLIC_BASE||'https://sim-worx.com';
assert.ok(['https://sim-worx.com','https://www.sim-worx.com'].includes(base));
const profile=await mkdtemp(path.join(os.tmpdir(),'simworx-reports-browser-'));
const child=spawn(process.env.CHROME_BIN||'/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=9227','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let socket;const pending=new Map();let seq=0;const exceptions=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 let targets;
 for(let i=0;i<60;i++){try{targets=await(await fetch('http://127.0.0.1:9227/json/list')).json();if(targets.length)break;}catch{}await pause(100);}
 assert.ok(targets?.[0]?.webSocketDebuggerUrl,'Chrome did not start');
 socket=new WebSocket(targets[0].webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const waiter=pending.get(message.id);pending.delete(message.id);if(message.error)waiter?.reject(new Error(message.error.message));else waiter?.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result?.value;};
 const waitFor=async expression=>{for(let i=0;i<90;i++){if(await evaluate(expression))return;await pause(500);}throw new Error('Live browser condition timed out: '+expression);};
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:base+'/reports/'});
 await waitFor("document.readyState==='complete'&&Boolean(document.querySelector('#pin'))");
 const pin=process.env.SIMWORX_REPORTS_PIN||'260873';
 await evaluate("document.querySelector('#pin').value="+JSON.stringify(pin)+";document.querySelector('#login-form').requestSubmit();true");
 await waitFor("document.querySelector('#app-shell')?.hidden===false");
 assert.equal(await evaluate("document.querySelectorAll('#primary-nav .nav-button').length"),10);
 assert.equal(await evaluate("document.querySelector('#data-mode').textContent.includes('DEMO')"),false);
 await evaluate("document.querySelector('#primary-nav [data-value=traffic]').click();true");
 await waitFor("document.querySelector('#page-title').textContent==='Traffic'");
 await evaluate("document.querySelector('#logout').click();true");
 await waitFor("document.querySelector('#login-screen')?.hidden===false");
 assert.deepEqual(exceptions,[]);
 console.log('Live browser passed: actual PIN login, real snapshot, ten sections, Traffic navigation and logout at '+base+'/reports/');
}finally{socket?.close();child.kill('SIGTERM');await pause(300);await rm(profile,{recursive:true,force:true}).catch(()=>{});}
