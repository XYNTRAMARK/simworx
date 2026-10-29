/* SIMWORX anonymous arrival counter v1.
   Records a minimal page arrival before analytics consent. No persistent cookie,
   no localStorage, no personal data. A session-only technical id links page
   arrivals in the current browser tab and can be joined to consented analytics. */
(function(window,document){
  'use strict';
  if(window.SimworxArrival || /^\/(reports|admin|portal)(\/|$)/i.test(location.pathname)) return;
  var script=document.currentScript;
  var endpoint=script&&script.dataset.endpoint||'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence';
  var KEY='swx_arrival_session_v1', TTL=30*60*1000;
  function uuid(){
    if(window.crypto&&window.crypto.randomUUID)return window.crypto.randomUUID();
    var a=new Uint8Array(16);if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(a);
    else for(var i=0;i<a.length;i++)a[i]=Math.random()*256;
    a[6]=a[6]&15|64;a[8]=a[8]&63|128;
    return Array.from(a,function(v){return v.toString(16).padStart(2,'0')}).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
  }
  function readSession(){
    var now=Date.now(),r=null;
    try{r=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){}
    if(!r||!r.id||!r.last_activity||now-r.last_activity>TTL)r={id:uuid(),last_activity:now};
    else r.last_activity=now;
    try{sessionStorage.setItem(KEY,JSON.stringify(r))}catch(_){}
    return r;
  }
  function clean(v,n){return typeof v==='string'?v.slice(0,n||240):''}
  function sourceGroup(t){
    var s=(t.utm_source||'').toLowerCase(),m=(t.utm_medium||'').toLowerCase(),d=t.referrer_domain||'',label=s+' '+d;
    if(/openai|chatgpt/.test(label)&&/paid|cpc|ppc|ads?/.test(m))return'OpenAI Ads';
    if(/google/.test(label))return /paid|cpc|ppc|ads?/.test(m)?'Google Ads':'Google Organic';
    if(/bing|microsoft/.test(label))return'Bing';
    if(/linkedin/.test(label))return'LinkedIn';
    if(/facebook|meta/.test(label))return'Facebook';
    if(/instagram/.test(label))return'Instagram';
    if(/email|newsletter/.test(s+' '+m))return'Email';
    if(!s&&!d)return'Direct';
    if(!s&&d)return'Referral';
    return'Other';
  }
  var params=new URLSearchParams(location.search),session=readSession(),arrivalId=uuid(),ref='';
  try{ref=new URL(document.referrer||'').hostname.toLowerCase()}catch(_){}
  var a={arrival_id:arrivalId,arrival_session_id:session.id,timestamp:new Date().toISOString(),
    page_url:location.href,referrer_domain:ref};
  ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','ad_group_id','ad_id'].forEach(function(k){
    var v=params.get(k);if(v)a[k]=clean(v);
  });
  a.click_id=clean(params.get('click_id')||params.get('ad_click_id')||params.get('openai_click_id')||params.get('oclickid')||'');
  var internal=ref && ref.replace(/^www\./,'')===location.hostname.replace(/^www\./,'');
  var hasCampaign=!!(a.utm_source||a.utm_medium||a.utm_campaign||a.campaign_id||a.ad_group_id||a.ad_id||a.click_id);
  if(internal&&!hasCampaign&&session.acquisition){
    Object.keys(session.acquisition).forEach(function(k){if(session.acquisition[k]!=null&&session.acquisition[k]!=='')a[k]=session.acquisition[k]});
  }else{
    a.source=sourceGroup(a);a.medium=a.utm_medium||'';a.campaign=a.utm_campaign||'';
    if(!session.acquisition){
      session.acquisition={source:a.source,medium:a.medium,campaign:a.campaign,utm_source:a.utm_source||'',utm_medium:a.utm_medium||'',utm_campaign:a.utm_campaign||'',utm_content:a.utm_content||'',utm_term:a.utm_term||'',campaign_id:a.campaign_id||'',ad_group_id:a.ad_group_id||'',ad_id:a.ad_id||'',click_id:a.click_id||''};
      try{sessionStorage.setItem(KEY,JSON.stringify(session))}catch(_){}
    }
  }
  if(!a.source)a.source=sourceGroup(a);
  if(a.medium==null)a.medium=a.utm_medium||'';
  if(a.campaign==null)a.campaign=a.utm_campaign||'';
  var ctx={arrival_id:arrivalId,arrival_session_id:session.id,source:a.source,campaign:a.campaign||'(none)'};
  window.SimworxArrival=Object.freeze({getContext:function(){return Object.assign({},ctx)}});
  try{
    fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'arrival',arrival:a}),
      keepalive:true,credentials:'omit',mode:'cors'}).catch(function(){});
  }catch(_){}
})(window,document);
