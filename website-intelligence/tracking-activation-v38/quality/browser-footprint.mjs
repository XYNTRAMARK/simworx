// Root-run rendered check. Serve current unmodified live sources or set QA_BASE_URL
// to the existing public site. Collection is mocked: no production test events.
import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:8765';
const output=path.join(project,'quality','browser-results');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const pages=(process.env.QA_PAGES||'/index.html,/contact.html,/led-screen-configurator.html,/projection-screen-configurator-v37.html').split(',');
const results=[];
try{
 for(const consent of [false,true])for(const pagePath of pages){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  if(consent)await context.addInitScript(()=>{
    localStorage.setItem('simworx_cookie_consent',JSON.stringify({essential:true,analytics:true,marketing:false,timestamp:new Date().toISOString(),version:'SWX-CKN-001-v1.0-2026-08-14'}));
  });
  const collected=[],trackingErrors=[];
  await context.route('**/functions/v1/simworx-intelligence',async route=>{
    if(route.request().method()==='POST')try{collected.push(...(route.request().postDataJSON().events||[]));}catch{}
    await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'},body:'{"accepted":1,"duplicates":0}'});
  });
  await context.route('**/assets/js/simworx-intelligence-*.js',async route=>{
    const filename=path.basename(new URL(route.request().url()).pathname);
    try{await route.fulfill({status:200,contentType:'application/javascript',body:await fs.readFile(path.join(project,'assets',filename))});}
    catch{await route.abort();}
  });
  if(process.env.QA_FIXTURE_ORIGIN)await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.includes('/functions/v1/simworx-intelligence')){
      if(route.request().method()==='POST')try{collected.push(...(route.request().postDataJSON().events||[]));}catch{}
      return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'},body:'{"accepted":1,"duplicates":0}'});
    }
    if(/\/assets\/js\/simworx-intelligence-[a-z0-9-]+\.js$/.test(url.pathname))return route.fulfill({status:200,contentType:'application/javascript',body:await fs.readFile(path.join(project,'assets',path.basename(url.pathname)))});
    if(!['sim-worx.com','www.sim-worx.com'].includes(url.hostname))return route.abort();
    try{const response=await fetch(process.env.QA_FIXTURE_ORIGIN+url.pathname+url.search);return route.fulfill({status:response.status,headers:{'content-type':response.headers.get('content-type')||'application/octet-stream'},body:Buffer.from(await response.arrayBuffer())});}catch{return route.abort();}
  });
  const page=await context.newPage();const browserErrors=[];page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text().slice(0,500));});page.on('pageerror',error=>{if(/intelligence|tracking/i.test(error.stack||String(error)))trackingErrors.push(String(error));});
  await page.goto(base+pagePath,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(Number(process.env.QA_SETTLE_MS)||2500);
  await page.evaluate(()=>document.fonts?.ready);
  const snapshot=()=>page.evaluate(()=>{
    const number=value=>Math.round(value*100)/100;
    const selector='h1,h2,h3,header,footer,nav,main,section,form,input,select,textarea,button,a,canvas,img';
    return {text:document.body.innerText,nodes:[...document.body.querySelectorAll(selector)].filter(element=>{const r=element.getBoundingClientRect();return r.width>0||r.height>0;}).map(element=>{
      const r=element.getBoundingClientRect(),s=getComputedStyle(element);
      return {tag:element.tagName,id:element.id,classes:element.className,rect:[r.x,r.y,r.width,r.height].map(number),style:[s.display,s.position,s.fontFamily,s.fontSize,s.color,s.backgroundColor,s.padding,s.margin,s.borderRadius,s.transform],value:['INPUT','SELECT','TEXTAREA'].includes(element.tagName)?element.value:undefined};
    })};
  });
  const label=pagePath.replace(/[^a-z0-9]+/gi,'_')+'-'+(consent?'consented':'no-consent');
  const mask=[page.locator('canvas,video,[aria-live]')];await page.screenshot({path:path.join(output,label+'-before.png'),fullPage:true,animations:'disabled',mask});
  await page.waitForTimeout(300);const before=await snapshot();
  await page.evaluate(async()=>{
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.id='simworx-intelligence-tracking';script.defer=true;script.src='/assets/js/simworx-intelligence-bootstrap-v2.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
    });
  });
  await page.waitForFunction(()=>Boolean(window.SimworxIntelligence));await page.waitForTimeout(700);
  await page.evaluate(()=>window.SimworxIntelligence.flush());
  const after=await snapshot();
  await fs.writeFile(path.join(output,label+'-before.json'),JSON.stringify(before));
  await fs.writeFile(path.join(output,label+'-after.json'),JSON.stringify(after));
  assert.deepEqual(after,before,'Tracking changed rendered text, control values, geometry or styling on '+pagePath);
  assert.deepEqual(trackingErrors,[]);
  if(consent)assert.ok(collected.some(event=>event.event_name==='page_view'),'Consented visit did not produce page_view: '+JSON.stringify({sdk:await page.evaluate(()=>window.SimworxIntelligence.getContext()),errors:browserErrors}));
  else assert.equal(collected.length,0,'Analytics sent without consent');
  await page.screenshot({path:path.join(output,label+'-after.png'),fullPage:true,animations:'disabled',mask});
  results.push({page:pagePath,consent,unchangedVisibleNodes:before.nodes.length,events:collected.length,passed:true});
  console.log(JSON.stringify(results.at(-1)));await context.close();
 }
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
}finally{await browser.close();}
