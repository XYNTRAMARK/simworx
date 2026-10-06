(() => {
  'use strict';

  const CONSENT_VERSION='SWX-CKN-001-v1.0-2026-08-14';
  const STORAGE_KEY='simworx_cookie_consent';
  const COOKIE_NAME='swx_cookie_consent';
  const MAX_AGE_SECONDS=60*60*24*365;
  let initialised=false;
  let currentConsent=null;
  let lastFocusedElement=null;

  const emptyConsent=()=>({
    essential:true,
    analytics:false,
    marketing:false,
    timestamp:new Date().toISOString(),
    version:CONSENT_VERSION
  });

  function readCookie(){
    const prefix=`${COOKIE_NAME}=`;
    const item=document.cookie.split('; ').find(part=>part.startsWith(prefix));
    if(!item) return null;
    try{return JSON.parse(decodeURIComponent(item.slice(prefix.length)));}catch(_error){return null;}
  }

  function readConsent(){
    let record=null;
    try{record=JSON.parse(localStorage.getItem(STORAGE_KEY));}catch(_error){record=null;}
    if(!record) record=readCookie();
    if(!record||record.version!==CONSENT_VERSION||!record.timestamp) return null;
    const age=Date.now()-Date.parse(record.timestamp);
    if(!Number.isFinite(age)||age<0||age>MAX_AGE_SECONDS*1000) return null;
    return {
      essential:true,
      analytics:record.analytics===true,
      marketing:record.marketing===true,
      timestamp:record.timestamp,
      version:CONSENT_VERSION
    };
  }

  function persistConsent(record){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(record));}catch(_error){}
    const secure=location.protocol==='https:'?'; Secure':'';
    document.cookie=`${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(record))}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  }

  function pushGoogleConsent(command,state){
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
    window.gtag('consent',command,{
      analytics_storage:state.analytics?'granted':'denied',
      ad_storage:state.marketing?'granted':'denied',
      ad_user_data:state.marketing?'granted':'denied',
      ad_personalization:state.marketing?'granted':'denied',
      functionality_storage:'granted',
      security_storage:'granted'
    });
  }

  function removeKnownNonEssentialCookies(){
    const names=document.cookie.split(';').map(item=>item.split('=')[0].trim()).filter(Boolean);
    names.filter(name=>name==='_ga'||name.startsWith('_ga_')||name==='_fbp'||name==='_fbc').forEach(name=>{
      document.cookie=`${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      document.cookie=`${name}=; Max-Age=0; Path=/; Domain=${location.hostname}; SameSite=Lax`;
    });
  }

  function activateConsentedScripts(category){
    document.querySelectorAll(`script[type="text/plain"][data-cookie-category="${category}"]:not([data-swx-activated])`).forEach(blocked=>{
      const active=document.createElement('script');
      [...blocked.attributes].forEach(attribute=>{
        if(!['type','data-cookie-category'].includes(attribute.name)) active.setAttribute(attribute.name,attribute.value);
      });
      active.dataset.swxActivated='true';
      active.text=blocked.text;
      blocked.dataset.swxActivated='true';
      blocked.after(active);
    });
  }

  function applyConsent(record,isDefault=false){
    currentConsent=record;
    pushGoogleConsent(isDefault?'default':'update',record);
    if(record.analytics) activateConsentedScripts('analytics');
    if(record.marketing) activateConsentedScripts('marketing');
    if(!record.analytics||!record.marketing) removeKnownNonEssentialCookies();
    window.dispatchEvent(new CustomEvent('simworx:consentchange',{detail:{...record}}));
  }

  function closeBanner(){
    const banner=document.getElementById('swx-cookie-banner');
    if(banner) banner.remove();
  }

  function closePreferences(){
    const panel=document.getElementById('swx-cookie-preferences');
    if(panel) panel.remove();
    if(lastFocusedElement&&typeof lastFocusedElement.focus==='function') lastFocusedElement.focus();
    lastFocusedElement=null;
  }

  function saveConsent(values){
    const record={
      essential:true,
      analytics:values.analytics===true,
      marketing:values.marketing===true,
      timestamp:new Date().toISOString(),
      version:CONSENT_VERSION
    };
    persistConsent(record);
    applyConsent(record);
    closeBanner();
    closePreferences();
  }

  function openPreferences(){
    closePreferences();
    lastFocusedElement=document.activeElement;
    const selected=currentConsent||emptyConsent();
    const wrapper=document.createElement('div');
    wrapper.id='swx-cookie-preferences';
    wrapper.className='swx-cookie-overlay';
    wrapper.innerHTML=`<section class="swx-cookie-panel" role="dialog" aria-modal="true" aria-labelledby="swx-cookie-panel-title"><div class="swx-cookie-panel-head"><div><span>COOKIE PREFERENCES</span><h2 id="swx-cookie-panel-title">Manage your cookie choices</h2></div><button class="swx-cookie-close" type="button" aria-label="Close cookie preferences">×</button></div><p class="swx-cookie-intro">Essential cookies remain active because they are required for website security, customer sessions and secure payments. Optional categories start off and are used only with your permission.</p><div class="swx-cookie-category"><div><h3>Essential</h3><p>Required for website security, customer accounts, baskets, checkout, payments and consent records.</p></div><span class="swx-cookie-always">Always active</span></div><label class="swx-cookie-category swx-cookie-toggle"><div><h3>Analytics</h3><p>Helps us understand how visitors use the website and improve performance.</p></div><input id="swx-consent-analytics" type="checkbox" ${selected.analytics?'checked':''}/><span aria-hidden="true"></span></label><label class="swx-cookie-category swx-cookie-toggle"><div><h3>Marketing</h3><p>Measures advertising and may support advertising audiences or personalisation.</p></div><input id="swx-consent-marketing" type="checkbox" ${selected.marketing?'checked':''}/><span aria-hidden="true"></span></label><div class="swx-cookie-panel-actions"><button data-cookie-action="reject" type="button">Reject all</button><button data-cookie-action="accept" type="button">Accept all</button><button class="swx-cookie-save" data-cookie-action="save" type="button">Save preferences</button></div><p class="swx-cookie-policy-link">Read our <a href="cookie-notice.html">Cookie Notice</a>.</p></section>`;
    document.body.appendChild(wrapper);

    wrapper.querySelector('.swx-cookie-close').addEventListener('click',closePreferences);
    wrapper.addEventListener('click',event=>{if(event.target===wrapper) closePreferences();});
    wrapper.querySelector('[data-cookie-action="reject"]').addEventListener('click',()=>saveConsent({analytics:false,marketing:false}));
    wrapper.querySelector('[data-cookie-action="accept"]').addEventListener('click',()=>saveConsent({analytics:true,marketing:true}));
    wrapper.querySelector('[data-cookie-action="save"]').addEventListener('click',()=>saveConsent({
      analytics:wrapper.querySelector('#swx-consent-analytics').checked,
      marketing:wrapper.querySelector('#swx-consent-marketing').checked
    }));
    wrapper.querySelector('.swx-cookie-close').focus();
  }

  function showBanner(){
    if(document.getElementById('swx-cookie-banner')) return;
    const banner=document.createElement('section');
    banner.id='swx-cookie-banner';
    banner.className='swx-cookie-banner';
    banner.setAttribute('role','dialog');
    banner.setAttribute('aria-modal','true');
    banner.setAttribute('aria-labelledby','swx-cookie-title');
    banner.innerHTML=`<div class="swx-cookie-banner-copy"><span>PRIVACY CONTROLS</span><h2 id="swx-cookie-title">Your cookie choices</h2><p>We use essential cookies to operate and secure our website, online shop and payments. With your permission, we also use analytics and marketing cookies to understand website use and measure advertising. Select “Accept all”, “Reject all” or “Manage preferences”. You can change your choice at any time through Cookie settings. Read our <a href="cookie-notice.html">Cookie Notice</a>.</p></div><div class="swx-cookie-banner-actions"><button data-cookie-action="accept" type="button">Accept all</button><button data-cookie-action="reject" type="button">Reject all</button><button data-cookie-action="manage" type="button">Manage preferences</button></div>`;
    document.body.appendChild(banner);
    banner.querySelector('[data-cookie-action="accept"]').addEventListener('click',()=>saveConsent({analytics:true,marketing:true}));
    banner.querySelector('[data-cookie-action="reject"]').addEventListener('click',()=>saveConsent({analytics:false,marketing:false}));
    banner.querySelector('[data-cookie-action="manage"]').addEventListener('click',openPreferences);
  }

  function bindFooterLinks(){
    document.querySelectorAll('[data-swx-cookie-settings]').forEach(button=>{
      if(button.dataset.swxBound) return;
      button.dataset.swxBound='true';
      button.addEventListener('click',openPreferences);
    });
  }

  function init(){
    bindFooterLinks();
    if(initialised) return;
    initialised=true;
    const saved=readConsent();
    const defaults=emptyConsent();
    applyConsent(defaults,true);
    if(saved) applyConsent(saved);
    else showBanner();
  }

  window.SimworxCookieConsent={
    init,
    open:openPreferences,
    getConsent:()=>currentConsent?{...currentConsent}:null
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
