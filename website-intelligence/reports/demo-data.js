/** Deterministic fictional data for the explicitly selected demonstration mode. */
export function demoSnapshot(now = new Date()) {
  const end = new Date(now).getTime();
  let seed = 260873;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = xs => xs[Math.floor(random() * xs.length)];
  const weighted = rows => { let r = random(); for (const [value, weight] of rows) { r -= weight; if (r <= 0) return value; } return rows.at(-1)[0]; };
  const iso = ms => new Date(ms).toISOString();
  const events = [], leads = [], configurations = [];
  const visitors = new Map(), leadByVisitor = new Map();
  let eventNumber = 0, sessionNumber = 0, visitorNumber = 0;
  const sources = [['Google Ads', .24], ['LinkedIn', .19], ['Google Organic', .18], ['Direct', .14], ['Facebook', .08], ['Email', .06], ['Instagram', .04], ['Referral', .03], ['OpenAI Ads', .025], ['Bing', .015]];
  const sourceData = {
    'Google Ads': ['google', 'cpc', 'GOOGLE-LED-02'], 'LinkedIn': ['linkedin', 'paid_social', 'LINKEDIN-LED-01'],
    'Google Organic': ['google', 'organic', ''], 'Direct': ['direct', 'none', ''], 'Facebook': ['facebook', 'paid_social', 'META-LED-03'],
    'Email': ['newsletter', 'email', 'AUTUMN-VISUAL-SYSTEMS'], 'Instagram': ['instagram', 'paid_social', 'META-VISUAL-04'],
    'Referral': ['flight-training.example.test', 'referral', 'PARTNER-TRAINING'], 'OpenAI Ads': ['openai', 'cpc', 'OPENAI-LED-01'], 'Bing': ['bing', 'organic', '']
  };
  const categories = [['Airliner', .36], ['Fighter', .25], ['GA / Piston', .16], ['Business Jet', .09], ['Helicopter', .08], ['Racing / Automotive', .04], ['Other', .02]];
  const models = {'Airliner':['Boeing 737','Airbus A320','Boeing 777','Airbus A350'], 'Fighter':['F-16','F/A-18','Eurofighter','F-35'], 'GA / Piston':['DA40','DA42','DA62','C172'], 'Business Jet':['Citation CJ4','Phenom 300','Gulfstream G650'], 'Helicopter':['H145','Bell 407','AW139'], 'Racing / Automotive':['GT cockpit','Formula cockpit'], 'Other':['Custom simulator']};
  const companyNames = ['Aster Flight Training','Meridian Simulation','Vector Flight Academy','Kestrel Aviation','Northstar Simulator Centre','Orion Technical College','Harbour Flight School','Falcon Training Systems'];
  const countries = [['United States', .29], ['United Kingdom', .24], ['Canada', .15], ['Germany', .10], ['Australia', .08], ['France', .06], ['Netherlands', .05], ['United Arab Emirates', .03]];
  const add = (visitor, session, time, name, page, properties) => {
    events.push({event_id: `demo_evt_${String(++eventNumber).padStart(7,'0')}`, visitor_id: visitor.id, session_id: session,
      event_name:name, page_url:page, timestamp:iso(time), properties});
    visitor.lastSeen = Math.max(visitor.lastSeen, time);
  };
  function makeSession(time, live = false, forceKnown = false) {
    const available = [...visitors.values()];
    let visitor;
    if (available.length && (forceKnown || random() < .32)) {
      const known = available.filter(v => leadByVisitor.has(v.id));
      visitor = pick(forceKnown && known.length ? known : available);
    } else {
      visitor = {id:`visitor_DEMO${String(++visitorNumber).padStart(4,'0')}`, firstSeen:time, lastSeen:time, country:weighted(countries)};
      visitors.set(visitor.id, visitor);
    }
    const session = `demo_session_${String(++sessionNumber).padStart(5,'0')}`;
    const source = live ? ['Google Ads','LinkedIn','Direct'][sessionNumber % 3] : weighted(sources);
    const [utm_source,utm_medium,campaign] = sourceData[source];
    if (!visitor.firstSource) { visitor.firstSource = source; visitor.firstCampaign = campaign; }
    const device = live ? 'Desktop' : weighted([['Desktop', .70], ['Mobile', .25], ['Tablet', .05]]);
    const type = live ? (sessionNumber % 2 ? 'led' : 'projection') : weighted([['led',.68],['projection',.32]]);
    const category = weighted(categories), model = pick(models[category]);
    const base = {source, campaign, utm_source,utm_medium,utm_campaign:campaign,utm_content:campaign ? 'visual-systems-autumn' : '',utm_term:source==='Google Ads'?'simulator visual system':'',ref_code:campaign,
      referrer: source==='Direct'?'':`https://${source==='LinkedIn'?'linkedin.com':source==='Google Ads'||source==='Google Organic'?'google.com':source==='Facebook'?'facebook.com':'referral.example.test'}/`,
      device,country:visitor.country,browser:device==='Mobile'?'Safari':pick(['Chrome','Chrome','Edge','Safari','Firefox']),os:device==='Mobile'?'iOS':pick(['Windows','macOS','Linux']),viewport_width:device==='Mobile'?390:1440,viewport_height:device==='Mobile'?844:900};
    const configBase = {...base, configurator_type:type,configurator_version:type==='led'?'led_v1':'projection_v25'};
    const cfgPage = type==='led'?'/led-screen-configurator.html':'/projection-screen-configurator-v25.html';
    const tick = live ? 4500 : 45000;
    let clock = time;
    const emit = (name,page,extra={}) => { add(visitor,session,clock,name,page,{...base,...extra}); clock += tick; };
    const cfg = (name,extra={}) => { add(visitor,session,clock,name,cfgPage,{...configBase,...extra});clock+=tick; };
    const landing = live ? '/visual-systems.html' : pick(['/','/visual-systems.html','/visual-systems.html','/simulators.html','/custom-simulators.html','/about.html']);
    emit('page_view',landing,{page_title:landing==='/'?'Simworx — Flight Simulation':landing.includes('visual')?'Visual Systems':'Flight Simulation'});
    emit('page_engagement',landing,{engagement_time:Math.round(15+random()*120),scroll_depth:pick([25,50,75,100])});
    if (random()<.28 && !live) emit('page_view','/visual-systems.html',{page_title:'Visual Systems'});
    if (random()<.56 || live) {
      emit('page_view',cfgPage,{page_title:type==='led'?'LED Screen Configurator':'Projection Screen Configurator'});
      cfg(`${type}_configurator_opened`);
      const startRate=device==='Mobile'?.61:source==='Facebook'?.64:.86;
      let active=live||random()<startRate;
      if(active){ cfg(`${type}_configurator_started`); active=live||random()<.88; }
      if(active){cfg('room_dimensions_entered',{room_dimensions:{width:10,length:12,height:4},room_width:10,room_length:12,room_height:4});active=live||random()<.9;}
      if(active){cfg('simulator_category_selected',{simulator_category:category,category});cfg('simulator_model_selected',{simulator_category:category,simulator_model:model,model});active=live||random()<(device==='Mobile'?.6:.87);}
      const shape=category==='Fighter'?weighted([['Hemispherical',.65],['Curved',.30],['Flat',.05]]):weighted([['Curved',.82],['Hemispherical',.1],['Flat',.08]]);
      const pitch=pick(['P1.2','P1.5','P1.8','P2.5']), diameter=pick([4,5,6,8]), fov=pick([180,200,220,240]);
      const options={screen_type:shape,screen_shape:shape,pixel_pitch:pitch,diameter,width:Math.round(diameter*2.2),height:3,horizontal_fov:fov,vertical_fov:pick([45,60,80,90]),resolution:pick(['7680 × 2160','5760 × 2160','3840 × 2160']),room_dimensions:{width:10,length:12,height:4},projector_type:pick(['UST','Short Throw','Standard Throw']),number_of_projectors:pick([3,4,5,6]),throw_ratio:pick([.35,.5,.72,1.1]),mount_style:pick(['Ceiling mount','Truss','Floor mount'])};
      if(active){cfg(type==='led'?'screen_configuration_completed':'screen_geometry_selected',{simulator_category:category,simulator_model:model,...options});if(type==='led')cfg('pixel_pitch_selected',{simulator_category:category,pixel_pitch:pitch});else cfg('projector_spec_generated',{simulator_category:category,projector_type:options.projector_type,number_of_projectors:options.number_of_projectors});active=!live&&random()<(source==='LinkedIn'?.89:.8);}
      if(active){
        const price=Math.round((type==='led'?35000:18000)+diameter*5500+random()*40000);
        const currency=weighted([['EUR',.82],['USD',.12],['GBP',.06]]);
        cfg(type==='led'?'price_viewed':'price_or_spec_viewed',{simulator_category:category,estimated_price:price,currency});
        if(random()<.91){
          const configId=`CFG-DEMO-${iso(clock).slice(0,10).replaceAll('-','')}-${String(configurations.length+1).padStart(5,'0')}`;
          cfg('configuration_completed',{configuration_id:configId,simulator_category:category,simulator_model:model,configuration_json:options,estimated_price:price,currency});
          const configuration={id:configId,visitor_id:visitor.id,session_id:session,lead_id:null,configurator_type:type,simulator_category:category,simulator_model:model,configuration_json:options,estimated_price:price,currency,emailed:false,created_at:iso(clock-tick)};
          configurations.push(configuration);
          const emailRate=source==='LinkedIn'?.78:source==='Facebook'?.35:.6;
          if(random()<emailRate){
            let lead=leadByVisitor.get(visitor.id);
            if(!lead){
              const n=leads.length+1;
              lead={id:`lead_demo_${String(n).padStart(4,'0')}`,email:`demo.contact.${String(n).padStart(3,'0')}@example.test`,name:pick(['Alex','Taylor','Morgan','Jordan','Casey','Sam','Robin','Jamie'])+' '+pick(['Morgan','Taylor','Lee','Reed','Parker','Ellis','Lane','Hayes']),company:pick(companyNames),telephone:'',country:visitor.country,visitor_ids:[visitor.id],first_seen:iso(visitor.firstSeen),last_seen:iso(clock),first_source:visitor.firstSource,latest_source:source,first_campaign:visitor.firstCampaign,latest_campaign:campaign,simulator_interest:category,status:pick(['NEW','NEW','ENGAGED','HIGH INTENT','CONTACTED','OPPORTUNITY','CUSTOMER','LOST']),notes:'Fictional demonstration contact.',marketing_consent:false,consent_timestamp:null,consent_text_version:null,consent_source:null};
              leads.push(lead);leadByVisitor.set(visitor.id,lead);
            }
            lead.last_seen=iso(clock);lead.latest_source=source;lead.latest_campaign=campaign;lead.simulator_interest=category;configuration.lead_id=lead.id;
            cfg('email_entered',{lead_id:lead.id,configuration_id:configId,simulator_category:category,simulator_model:model,email:lead.email});
            if(random()<.58&&!lead.marketing_consent){lead.marketing_consent=true;lead.consent_timestamp=iso(clock);lead.consent_text_version='product-news-v1';lead.consent_source=cfgPage;cfg('marketing_consent_given',{lead_id:lead.id,marketing_consent:true,consent:true,consent_text_version:'product-news-v1',consent_text:'Send me occasional Simworx product news and updates'});}
            if(random()<.91){cfg('configuration_emailed',{lead_id:lead.id,configuration_id:configId,simulator_category:category});configuration.emailed=true;}
            if(random()<.34){emit('page_view','/contact.html',{page_title:'Contact Simworx'});emit('enquiry_submitted','/contact.html',{lead_id:lead.id,configuration_id:configId,simulator_category:category,configurator_type:type});}
          }
        }
      }
      if(!live&&random()<.035)cfg('error',{error_type:pick(['model_load_failure','email_sending_failure','api_failure']),message:'Fictional demonstration error',duration_ms:Math.round(1000+random()*4000)});
      if(!live&&random()<.22)cfg('performance',{metric:'configurator_initial_load',duration_ms:Math.round(350+random()*2100)});
      if(live)cfg('heartbeat',{simulator_category:category,simulator_model:model,last_step:'Screen setup'});
    }
    if(!live&&random()<.1)emit('page_view','/contact.html',{page_title:'Contact Simworx'});
    const lead=leadByVisitor.get(visitor.id);
    if(lead){lead.last_seen=iso(visitor.lastSeen);lead.latest_source=source;lead.latest_campaign=campaign;}
  }
  const utcToday=Date.UTC(new Date(end).getUTCFullYear(),new Date(end).getUTCMonth(),new Date(end).getUTCDate());
  for(let day=190;day>=1;day--){
    const count=day<=30?4+Math.floor(random()*3):day<=90?3+Math.floor(random()*3):2+Math.floor(random()*3);
    for(let j=0;j<count;j++)makeSession(utcToday-day*86400000+(8+random()*10)*3600000);
  }
  // Current sessions are intentionally unfinished and active. Every event remains before `now`.
  for(let j=0;j<3;j++)makeSession(end-(89-j*5)*1000,true,j===2);
  events.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  for(const lead of leads){const visitor=visitors.get(lead.visitor_ids[0]);lead.first_seen=iso(visitor.firstSeen);lead.last_seen=iso(visitor.lastSeen);}
  return {events,leads,configurations,settings:{},meta:{demo:true,label:'Demonstration data — not live website traffic',generated_at:iso(end),timezone:'Europe/Paris',source:'Deterministic fictional demonstration fixture',collection_enabled:false}};
}
