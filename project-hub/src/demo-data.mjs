export const seed = () => ({
  version:1,
  organizations:[
    {id:'noah',name:'NOAH',code:'NOAH',accent:'#5067c9',logo:'N',contact:'United States'},
    {id:'jetpro',name:'JetPro Aviation',code:'JET',accent:'#169883',logo:'J',contact:'Canada'},
    {id:'ksu',name:'Kingdom Flight School',code:'KFS',accent:'#bb873e',logo:'K',contact:'Saudi Arabia'},
    {id:'alpine',name:'Alpine Aviation',code:'ALP',accent:'#8b65d6',logo:'A',contact:'Switzerland'}
  ],
  projects:[
    {id:'p1',orgId:'noah',name:'NOAH — Advanced Training Simulator',code:'SW-26041',template:'Bespoke Simulator',status:'In production',phase:'Manufacturing',due:'2027-03-18',budget:425000,contract:575000,spent:172400,committed:116000,publishedProgress:38,lead:'James Davies',description:'Multi-station bespoke simulation system including cockpit, visual display, control loading and training software.',publicDescription:'A custom-built advanced training simulator with integrated cockpit controls and immersive visual systems.',created:'2026-09-12'},
    {id:'p2',orgId:'jetpro',name:'DA62 — Canada Training Suite',code:'SW-26038',template:'DA62',status:'In production',phase:'Assembly',due:'2027-01-28',budget:180000,contract:249000,spent:101200,committed:41400,publishedProgress:64,lead:'Mark Evans',description:'Diamond DA62 cockpit and flight training suite.',created:'2026-08-21'},
    {id:'p3',orgId:'ksu',name:'King Air 360 — Simulator 01',code:'SW-26032',template:'King Air 360',status:'In production',phase:'Manufacturing',due:'2027-02-12',budget:510000,contract:690000,spent:221000,committed:162000,publishedProgress:42,lead:'Priya Singh',description:'Full King Air 360 flight simulator system.',created:'2026-07-04'},
    {id:'p4',orgId:'alpine',name:'Motion Platform Retrofit',code:'SW-26044',template:'Motion Upgrade',status:'Design',phase:'Engineering',due:'2027-04-09',budget:75000,contract:109000,spent:8200,committed:14500,publishedProgress:12,lead:'Tom Barrett',description:'Six-axis motion platform integration and controls.',created:'2026-10-18'}
  ],
  sections:[
    {id:'s1',projectId:'p1',name:'Cockpit shell',weight:20},{id:'s2',projectId:'p1',name:'Control loading & mechanics',weight:20},{id:'s3',projectId:'p1',name:'Visual system',weight:20},{id:'s4',projectId:'p1',name:'Avionics & software',weight:25},{id:'s5',projectId:'p1',name:'Testing & delivery',weight:15},
    {id:'s6',projectId:'p2',name:'DA62 cockpit',weight:35},{id:'s7',projectId:'p2',name:'Visual system',weight:30},{id:'s8',projectId:'p2',name:'Commissioning',weight:35},
    {id:'s9',projectId:'p3',name:'Cockpit structure',weight:35},{id:'s10',projectId:'p3',name:'Control loading',weight:30},{id:'s11',projectId:'p3',name:'Flight deck integration',weight:35},
    {id:'s12',projectId:'p4',name:'Mechanical engineering',weight:50},{id:'s13',projectId:'p4',name:'Electronics & control',weight:50}
  ],
  tasks:[
    {id:'t1',start:'2026-10-27',projectId:'p1',sectionId:'s1',title:'Approve cockpit shell CAD',department:'Office',assignee:'James Davies',status:'Done',priority:'High',due:'2026-11-04'},
    {id:'t2',start:'2026-11-04',predecessors:['t1'],projectId:'p1',sectionId:'s1',title:'CNC cut primary frames',department:'Workshop',assignee:'Marco Ferrer',status:'Done',priority:'High',due:'2026-11-06'},
    {id:'t3',start:'2026-11-09',predecessors:['t2'],projectId:'p1',sectionId:'s1',title:'Weld cockpit frame',department:'Workshop',assignee:'Marco Ferrer',status:'In progress',priority:'High',due:'2026-11-21'},
    {id:'t4',start:'2026-11-23',predecessors:['t3'],projectId:'p1',sectionId:'s1',title:'Fit panels and inspect shell',department:'Quality',assignee:'Tom Barrett',status:'Ready',priority:'Normal',due:'2026-11-27'},
    {id:'t5',start:'2026-10-25',projectId:'p1',sectionId:'s2',title:'Specify control loading motors',department:'Office',assignee:'James Davies',status:'Done',priority:'High',due:'2026-11-02'},
    {id:'t6',start:'2026-11-10',predecessors:['t5'],projectId:'p1',sectionId:'s2',title:'Procure pitch & roll assemblies',department:'Purchasing',assignee:'Sarah Miles',status:'Blocked',priority:'High',due:'2026-11-18'},
    {id:'t7',start:'2026-11-12',projectId:'p1',sectionId:'s3',title:'Finalise projection geometry',department:'Office',assignee:'Priya Singh',status:'In progress',priority:'Normal',due:'2026-11-23'},
    {id:'t8',start:'2026-11-24',predecessors:['t7'],projectId:'p1',sectionId:'s3',title:'Build screen support structure',department:'Workshop',assignee:'Marco Ferrer',status:'Ready',priority:'Normal',due:'2026-12-05'},
    {id:'t9',start:'2026-11-09',projectId:'p1',sectionId:'s4',title:'Avionics signal mapping',department:'Office',assignee:'Priya Singh',status:'In progress',priority:'Normal',due:'2026-11-26'},
    {id:'t10',start:'2026-11-27',predecessors:['t9'],projectId:'p1',sectionId:'s4',title:'Wire harness fabrication',department:'Workshop',assignee:'Tom Barrett',status:'Backlog',priority:'Normal',due:'2026-12-18'},
    {id:'t11',start:'2027-01-05',predecessors:['t4', 't8'],projectId:'p1',sectionId:'s5',title:'Prepare customer FAT checklist',department:'Quality',assignee:'James Davies',status:'Backlog',priority:'Normal',due:'2027-01-18'},
    {id:'t12',start:'2026-11-03',projectId:'p2',sectionId:'s6',title:'Install DA62 instrument panels',department:'Workshop',assignee:'Marco Ferrer',status:'In progress',priority:'High',due:'2026-11-17'},
    {id:'t13',start:'2026-11-08',projectId:'p2',sectionId:'s7',title:'Projector edge blending',department:'Office',assignee:'Priya Singh',status:'Inspection',priority:'Normal',due:'2026-11-20'},
    {id:'t14',start:'2027-01-04',predecessors:['t12', 't13'],projectId:'p2',sectionId:'s8',title:'Factory acceptance test',department:'Quality',assignee:'James Davies',status:'Backlog',priority:'High',due:'2027-01-12'},
    {id:'t15',start:'2026-11-06',projectId:'p3',sectionId:'s9',title:'Machining shell components',department:'Workshop',assignee:'Marco Ferrer',status:'In progress',priority:'High',due:'2026-11-20'},
    {id:'t16',start:'2026-11-23',projectId:'p3',sectionId:'s10',title:'Control loading rig verification',department:'Office',assignee:'James Davies',status:'Ready',priority:'Normal',due:'2026-11-29'},
    {id:'t17',start:'2026-11-20',projectId:'p3',sectionId:'s11',title:'Avionics integration layout',department:'Office',assignee:'Priya Singh',status:'In progress',priority:'Normal',due:'2026-12-04'},
    {id:'t18',start:'2026-11-10',projectId:'p4',sectionId:'s12',title:'Motion base design review',department:'Office',assignee:'Tom Barrett',status:'In progress',priority:'High',due:'2026-11-25'},
    {id:'t19',start:'2026-11-26',predecessors:['t18'],projectId:'p4',sectionId:'s13',title:'Motion controller wiring design',department:'Office',assignee:'Priya Singh',status:'Backlog',priority:'Normal',due:'2026-12-02'}
  ],
  parts:[
    {id:'part1',code:'SW-AL-100',name:'Aluminium frame extrusion',unit:'m',onHand:142,reserved:36,min:40,cost:18,location:'A1 · Materials',supplier:'AluSupply'},
    {id:'part2',code:'SW-BRU-200',name:'Force feedback motor assembly',unit:'ea',onHand:8,reserved:6,min:4,cost:1190,location:'B2 · Controls',supplier:'Brunner'},
    {id:'part3',code:'SW-PCB-028',name:'Interface controller PCB',unit:'ea',onHand:23,reserved:12,min:10,cost:145,location:'C1 · Electronics',supplier:'Avionix'},
    {id:'part4',code:'SW-FIX-012',name:'M6 stainless fastener set',unit:'set',onHand:34,reserved:28,min:20,cost:19,location:'A3 · Hardware',supplier:'Fixings Direct'},
    {id:'part5',code:'SW-PRO-070',name:'Short-throw projector',unit:'ea',onHand:5,reserved:4,min:3,cost:2170,location:'D2 · Visuals',supplier:'Projection Systems'},
    {id:'part6',code:'SW-CAB-024',name:'Shielded signal cable (24 core)',unit:'m',onHand:270,reserved:120,min:100,cost:9,location:'C3 · Wiring',supplier:'CablePro'},
    {id:'part7',code:'SW-SEAT-1',name:'Aircraft-style pilot seat',unit:'ea',onHand:2,reserved:2,min:2,cost:1250,location:'E1 · Interiors',supplier:'Seating Works'}
  ],
  bom:[
    {id:'bom1',projectId:'p1',sectionId:'s1',partId:'part1',required:62,reserved:24,issued:16},
    {id:'bom2',projectId:'p1',sectionId:'s2',partId:'part2',required:4,reserved:2,issued:0},
    {id:'bom3',projectId:'p1',sectionId:'s4',partId:'part3',required:10,reserved:6,issued:0},
    {id:'bom4',projectId:'p1',sectionId:'s1',partId:'part4',required:24,reserved:18,issued:8},
    {id:'bom5',projectId:'p1',sectionId:'s3',partId:'part5',required:4,reserved:3,issued:0},
    {id:'bom6',projectId:'p2',sectionId:'s6',partId:'part2',required:2,reserved:2,issued:1},
    {id:'bom7',projectId:'p3',sectionId:'s9',partId:'part1',required:36,reserved:12,issued:8}
  ],
  orders:[
    {id:'po1',code:'PO-260118',projectId:'p1',supplier:'Brunner',status:'Awaiting delivery',date:'2026-11-05',items:[{partId:'part2',quantity:4,received:0,unitCost:1190}]},
    {id:'po2',code:'PO-260115',projectId:'p3',supplier:'AluSupply',status:'Part received',date:'2026-10-28',items:[{partId:'part1',quantity:65,received:30,unitCost:18}]},
    {id:'po3',code:'PO-260112',projectId:'p1',supplier:'Projection Systems',status:'Awaiting delivery',date:'2026-10-24',items:[{partId:'part5',quantity:4,received:0,unitCost:2170}]},
    {id:'po4',code:'PO-260104',projectId:'p2',supplier:'CablePro',status:'Received',date:'2026-10-12',items:[{partId:'part6',quantity:200,received:200,unitCost:9}]}
  ],
  movements:[
    {id:'mv1',partId:'part1',quantity:30,type:'receipt',actor:'Stores',projectId:'p3',date:'2026-11-10T09:42:00Z'},
    {id:'mv2',partId:'part4',quantity:8,type:'issue',actor:'Stores',projectId:'p1',date:'2026-11-09T13:22:00Z'}
  ],
  updates:[
    {id:'u1',projectId:'p1',kind:'Milestone',title:'Cockpit structural design approved',description:'The structural CAD review is complete and the cockpit frame is now in manufacture.',status:'published',date:'2026-11-06',publishedAt:'2026-11-06',part:'Cockpit shell'},
    {id:'u2',projectId:'p1',kind:'Component',title:'Primary cockpit frames CNC manufactured',description:'The first set of cockpit shell frame elements has been cut and passed initial dimensional checks.',status:'published',date:'2026-11-09',publishedAt:'2026-11-09',part:'Cockpit shell'},
    {id:'u3',projectId:'p1',kind:'Internal draft',title:'Control loading lead time review',description:'Supplier delivery risk under assessment. Keep internal pending resolution.',status:'draft',date:'2026-11-11',part:'Controls'},
    {id:'u4',projectId:'p2',kind:'Component',title:'Instrument panel installation underway',description:'The DA62 instrumentation is being fitted ahead of integration testing.',status:'published',date:'2026-11-09',publishedAt:'2026-11-09',part:'Cockpit'},
    {id:'u5',projectId:'p3',kind:'Milestone',title:'Engineering drawing package released',description:'Approved build drawings are available to the project team.',status:'published',date:'2026-11-03',publishedAt:'2026-11-03',part:'Structure'}
  ],
  approvals:[
    {id:'a1',projectId:'p1',orgId:'noah',title:'Cockpit panel layout — Rev C',kind:'Drawing',revision:'Rev C',status:'Pending',requested:'2026-11-10',due:'2026-11-20',shared:true},
    {id:'a2',projectId:'p1',orgId:'noah',title:'Control loading specification — Rev B',kind:'Specification',revision:'Rev B',status:'Pending',requested:'2026-11-11',due:'2026-11-24',shared:true},
    {id:'a3',projectId:'p2',orgId:'jetpro',title:'Visual display geometry — Rev A',kind:'Drawing',revision:'Rev A',status:'Approved',requested:'2026-10-28',due:'2026-11-07',shared:true},
    {id:'a4',projectId:'p3',orgId:'ksu',title:'Cockpit shell acceptance',kind:'Milestone',revision:'Snapshot 01',status:'Pending',requested:'2026-11-08',due:'2026-11-22',shared:true}
  ],
  documents:[
    {id:'d1',projectId:'p1',title:'Cockpit shell general arrangement',rev:'C',type:'PDF drawing',visibility:'customer',date:'2026-11-10'},
    {id:'d2',projectId:'p1',title:'Detailed supplier quotation',rev:'1',type:'PDF',visibility:'internal',date:'2026-11-08'},
    {id:'d3',projectId:'p1',title:'Manufacturing inspection checklist',rev:'A',type:'PDF',visibility:'internal',date:'2026-11-10'},
    {id:'d4',projectId:'p2',title:'DA62 visual layout',rev:'A',type:'PDF drawing',visibility:'customer',date:'2026-11-04'}
  ],
  members:[
    {id:'m1',orgId:'noah',name:'Alex Carter',email:'alex@example.invalid',role:'Client Lead',projects:['p1']},
    {id:'m2',orgId:'noah',name:'Morgan Ellis',email:'morgan@example.invalid',role:'Client Engineer',projects:['p1']},
    {id:'m3',orgId:'noah',name:'Taylor Brooks',email:'taylor@example.invalid',role:'Client Approver',projects:['p1']},
    {id:'m4',orgId:'jetpro',name:'Jordan Lane',email:'jordan@example.invalid',role:'Client Lead',projects:['p2']},
    {id:'m5',orgId:'ksu',name:'Robin Blake',email:'robin@example.invalid',role:'Client Lead',projects:['p3']}
  ],
  messages:[
    {id:'msg1',projectId:'p1',author:'NOAH Project Lead',text:'The latest cockpit structure update looks good. Please share the next drawings when ready.',visibility:'customer',at:'2026-11-10T10:22:00Z'},
    {id:'msg2',projectId:'p1',author:'Sim-Worx Project Team',text:'Thank you. The panel layout Rev C is available in your approvals inbox.',visibility:'customer',at:'2026-11-11T11:03:00Z'},
    {id:'msg3',projectId:'p1',author:'Procurement',text:'Discuss potential supplier delay internally before customer publication.',visibility:'internal',at:'2026-11-11T12:00:00Z'}
  ],
  notifications:[
    {id:'n1',text:'NOAH panel layout is awaiting customer approval.',date:'2026-11-12',read:false},
    {id:'n2',text:'Force feedback motor stock is nearing its reserved limit.',date:'2026-11-11',read:false}
  ],
  audit:[
    {id:'log1',actor:'Sim-Worx Admin',action:'Customer publication',detail:'Primary cockpit frames CNC manufactured',at:'2026-11-09T10:14:00Z'},
    {id:'log2',actor:'Stores',action:'Stock receipt',detail:'30 × SW-AL-100',at:'2026-11-10T09:42:00Z'},
    {id:'log3',actor:'Sim-Worx Admin',action:'Approval request',detail:'Cockpit panel layout — Rev C',at:'2026-11-10T14:02:00Z'}
  ],
  settings:{theme:'light'}
});
