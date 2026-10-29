import {buildReport} from '../../reports/analytics.js';
let seq=0;
const ev=(s,v,n,t,p={},m=0)=>({event_id:'e'+(++seq),session_id:s,visitor_id:v,event_name:n,page_url:t==='led'?'/led-screen-configurator.html':t==='projection'?'/projection-screen-configurator.html':'/a320-single-seat.html',timestamp:new Date(Date.UTC(2026,9,28,10,m,seq)).toISOString(),properties:{configurator_type:t,configurator_version:t+'-test',...p}});
const snapshot={settings:{timezone:'Europe/Madrid'},visitors:[],sessions:[],leads:[],configurations:[],events:[
 ev('sl','vl','led_configurator_opened','led',{},0),ev('sl','vl','led_configurator_started','led',{},1),ev('sl','vl','screen_configuration_completed','led',{},2),ev('sl','vl','configuration_copy_requested','led',{copy_action:'email'},3),ev('sl','vl','email_entered','led',{copy_action:'email'},4),
 ev('sp','vp','projection_configurator_opened','projection',{},0),ev('sp','vp','projection_configurator_started','projection',{},1),ev('sp','vp','room_dimensions_entered','projection',{},2),ev('sp','vp','screen_configuration_completed','projection',{},3),ev('sp','vp','projector_spec_generated','projection',{},4),ev('sp','vp','configuration_completed','projection',{configuration_id:'P'},5),
 ev('sc','vc','cockpit_configurator_opened','cockpit',{},0),ev('sc','vc','cockpit_configurator_started','cockpit',{},1),ev('sc','vc','product_configurator_started','cockpit',{},2)
]};
const r=buildReport(snapshot,{preset:'Custom',from:'2026-10-28',to:'2026-10-28',compare:false},new Date('2026-10-29T09:00:00Z'));
if(r.metrics.configuratorStarts!==3)throw new Error('starts '+r.metrics.configuratorStarts);
if(r.metrics.completed!==2)throw new Error('completed '+r.metrics.completed);
if(r.configuratorMetrics.led.completed!==1)throw new Error('LED final inference');
if(r.configuratorMetrics.projection.completed!==1)throw new Error('Projection completion');
if(r.configuratorMetrics.cockpit.configuratorStarts!==1)throw new Error('Cockpit start');
if(r.meta.timezone!=='Europe/Madrid')throw new Error('timezone '+r.meta.timezone);
console.log('REPORTING_V3_ANALYTICS_PASS');