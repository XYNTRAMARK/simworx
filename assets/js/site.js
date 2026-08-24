const header=document.querySelector('.site-header');
const toggle=document.querySelector('.nav-toggle');
if(toggle) toggle.addEventListener('click',()=>header.classList.toggle('open'));

/* Mobile/desktop parity layer */
const parityCss=document.createElement('link');
parityCss.rel='stylesheet';
parityCss.href='assets/css/mobile-sync.css?v=20260824';
document.head.appendChild(parityCss);

/* Current asset versioning prevents stale mobile/CDN images. */
const assetVersion='20260824';
document.querySelectorAll('img[src]').forEach(img=>{
  const src=img.getAttribute('src');
  if(!src || src.startsWith('data:') || src.startsWith('blob:')) return;
  const separator=src.includes('?')?'&':'?';
  if(!src.includes(`v=${assetVersion}`)) img.setAttribute('src',`${src}${separator}v=${assetVersion}`);
  img.addEventListener('error',()=>{
    if(img.dataset.retry==='1') return;
    img.dataset.retry='1';
    const clean=img.getAttribute('src').replace(/([?&])retry=1(&|$)/,'$1').replace(/[?&]$/,'');
    img.setAttribute('src',`${clean}${clean.includes('?')?'&':'?'}retry=1`);
  });
});

/*
  SITE-WIDE SEO
  One source of truth for page intent. This supplements the static HTML and
  ensures every public page has a unique title, description, canonical URL,
  Open Graph/Twitter metadata and structured WebPage data.
*/
const SEO_BASE='https://www.sim-worx.com';
const SEO_DEFAULT_IMAGE=`${SEO_BASE}/assets/images/concorde-hero.webp`;
const seoPages={
  'index.html':{
    title:'Flight Simulators, Mission Systems & Custom Simulation | Simworx',
    description:'Simworx designs and builds professional flight simulators, custom cockpit systems, mission training solutions, visual systems and simulation software for aviation, defence, government, research and enthusiasts.',
    image:'assets/images/concorde-hero.webp'
  },
  'simulators.html':{
    title:'Professional Flight Simulators & Training Devices | Simworx',
    description:'Professional flight simulators and training platforms for GA, airline, military and special-mission applications, including A320, DA62, DA42, King Air 360, C172 and F-16 systems.'
  },
  'mission-systems.html':{
    title:'Flight Simulator Mission Systems & Sensor Training | Simworx',
    description:'Custom simulator mission systems for search and rescue, LIDAR, maritime, ISR, coastguard, flood response and specialist operational training with integrated sensors and scenario software.',
    image:'assets/images/mission-hero.webp'
  },
  'software.html':{
    title:'Flight Simulator Software & PC Optimisation Tools | Simworx',
    description:'Simworx develops simulator software, Windows utilities, launch management, mission workflow tools and PC optimisation software for professional and home simulation environments.',
    image:'assets/images/simstarter.webp'
  },
  'simstarter.html':{
    title:'SimStarter Pro | One-Click Simulator Program Launcher',
    description:'SimStarter Pro launches your complete simulator environment in one click. Create profiles, detect simulator programs, control launch order, timings, diagnostics and remote startup.',
    image:'assets/images/simstarter.webp'
  },
  'gameitizer.html':{
    title:'Gameitizer PC Optimiser for Gaming & Simulation | Simworx',
    description:'Gameitizer is a Windows PC optimisation and diagnostics tool for gaming and simulation, designed to reduce background load, identify bottlenecks and improve system performance.',
    image:'assets/images/gameitizer.webp'
  },
  'frames.html':{
    title:'Flight Simulator Cockpit Shells & Frames | Simworx',
    description:'CAD-designed cockpit shells, aluminium simulator frames and structural assemblies for professional flight simulators, avionics integration and serious DIY cockpit builds.'
  },
  'visual-systems.html':{
    title:'Flight Simulator Visual Systems, Projection & LED | Simworx',
    description:'Flight simulator visual systems including multi-monitor displays, 180–220° projection, curved direct-view LED, hemispherical LED and mixed-reality solutions.',
    image:'assets/images/projection-screen.webp'
  },
  'custom-simulators.html':{
    title:'Custom Flight Simulator Design & Manufacturing | Simworx',
    description:'Bespoke flight simulator design and manufacturing for enthusiast, professional training, military, research and qualification-ready projects, from concept and CAD through installation.',
    image:'assets/images/concorde-hero.webp'
  },
  'about.html':{
    title:'About Simworx | Flight Simulator Engineering & Software',
    description:'Learn about Simworx, a specialist flight simulator engineering company with operations in Spain and the USA, building aviation, defence, government, research and entertainment simulation systems.',
    image:'assets/images/concorde-hero.webp'
  },
  'contact.html':{
    title:'Contact Simworx | Flight Simulator Projects & Engineering',
    description:'Contact Simworx in Spain or the USA to discuss a flight simulator, custom cockpit, mission system, visual system, simulation software or specialist engineering project.'
  },
  'downloads.html':{
    title:'Simworx Software Downloads',
    description:'Official Simworx software downloads for simulator utilities and supporting applications.',
    noindex:true
  },
  'brochure.html':{
    title:'Simworx Flight Simulator Brochure',
    description:'Simworx flight simulator capabilities brochure covering professional simulators, custom projects, mission systems, visual systems and software.',
    noindex:true
  },
  'privacy.html':{title:'Privacy Policy | Simworx',description:'Simworx privacy policy.',noindex:true},
  'terms.html':{title:'Terms & Conditions | Simworx',description:'Simworx website terms and conditions.',noindex:true},
  'cookies.html':{title:'Cookie Policy | Simworx',description:'Simworx cookie policy and cookie information.',noindex:true}
};

const pathname=(location.pathname.split('/').pop()||'index.html').toLowerCase();
const seo=seoPages[pathname]||seoPages['index.html'];
const canonical=pathname==='index.html'?`${SEO_BASE}/`:`${SEO_BASE}/${pathname}`;
const image=seo.image?`${SEO_BASE}/${seo.image}`:SEO_DEFAULT_IMAGE;

document.title=seo.title;

function upsertMeta(selector,attrs){
  let el=document.head.querySelector(selector);
  if(!el){el=document.createElement('meta');document.head.appendChild(el);}
  Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
}
function upsertLink(rel,href){
  let el=document.head.querySelector(`link[rel="${rel}"]`);
  if(!el){el=document.createElement('link');el.rel=rel;document.head.appendChild(el);}
  el.href=href;
}

upsertMeta('meta[name="description"]',{name:'description',content:seo.description});
upsertMeta('meta[name="robots"]',{name:'robots',content:seo.noindex?'noindex,follow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'});
upsertMeta('meta[property="og:type"]',{property:'og:type',content:'website'});
upsertMeta('meta[property="og:site_name"]',{property:'og:site_name',content:'Simworx'});
upsertMeta('meta[property="og:title"]',{property:'og:title',content:seo.title});
upsertMeta('meta[property="og:description"]',{property:'og:description',content:seo.description});
upsertMeta('meta[property="og:url"]',{property:'og:url',content:canonical});
upsertMeta('meta[property="og:image"]',{property:'og:image',content:image});
upsertMeta('meta[name="twitter:card"]',{name:'twitter:card',content:'summary_large_image'});
upsertMeta('meta[name="twitter:title"]',{name:'twitter:title',content:seo.title});
upsertMeta('meta[name="twitter:description"]',{name:'twitter:description',content:seo.description});
upsertMeta('meta[name="twitter:image"]',{name:'twitter:image',content:image});
upsertLink('canonical',canonical);

/* Descriptive image alt text is required; decorative imagery should remain empty. */
const altByImage={
  'concorde-hero.webp':'Custom-built Concorde flight simulator cockpit by Simworx',
  'mission-hero.webp':'Flight simulator mission system and operator interface by Simworx',
  'simstarter.webp':'SimStarter Pro simulator program launcher and profile management interface',
  'gameitizer.webp':'Gameitizer PC optimisation and diagnostics interface for gaming and simulation',
  'projection-screen.webp':'Curved multi-projector visual system for a flight simulator',
  'hemispherical-led.webp':'Immersive curved LED visual display system for flight simulation'
};
document.querySelectorAll('img[src]').forEach(img=>{
  const raw=(img.getAttribute('src')||'').split('?')[0];
  const name=raw.split('/').pop();
  if(altByImage[name]) img.alt=altByImage[name];
  else if(!img.hasAttribute('alt')) img.alt='';
});

/* Structured data: organisation identity + the current web page. */
const structured={
  '@context':'https://schema.org',
  '@graph':[
    {
      '@type':'Organization',
      '@id':`${SEO_BASE}/#organization`,
      'name':'Simworx',
      'url':`${SEO_BASE}/`,
      'description':'Specialist flight simulator engineering, mission systems, visual systems and simulation software.',
      'email':'sales@sim-worx.com',
      'areaServed':'Worldwide'
    },
    {
      '@type':'WebSite',
      '@id':`${SEO_BASE}/#website`,
      'url':`${SEO_BASE}/`,
      'name':'Simworx',
      'publisher':{'@id':`${SEO_BASE}/#organization`},
      'inLanguage':'en'
    },
    {
      '@type':'WebPage',
      '@id':`${canonical}#webpage`,
      'url':canonical,
      'name':seo.title,
      'description':seo.description,
      'isPartOf':{'@id':`${SEO_BASE}/#website`},
      'about':{'@id':`${SEO_BASE}/#organization`},
      'primaryImageOfPage':{'@type':'ImageObject','url':image},
      'inLanguage':'en'
    }
  ]
};
let ld=document.head.querySelector('script[data-simworx-seo]');
if(!ld){ld=document.createElement('script');ld.type='application/ld+json';ld.dataset.simworxSeo='1';document.head.appendChild(ld);}
ld.textContent=JSON.stringify(structured);

document.querySelectorAll('[data-static-form]').forEach(form=>{
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const data=new FormData(form);
    const lines=[];
    for(const [k,v] of data.entries()) if(String(v).trim()) lines.push(`${k}: ${v}`);
    const subject=encodeURIComponent(form.dataset.subject||'Simworx website enquiry');
    const body=encodeURIComponent(lines.join('\n'));
    window.location.href=`mailto:sales@sim-worx.com?subject=${subject}&body=${body}`;
  });
});
