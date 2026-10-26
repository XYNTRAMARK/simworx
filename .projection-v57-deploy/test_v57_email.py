from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v57.html"

snapshot={
  "configuration":{
    "currency":"GBP","diameter":4.5,"horizontalFov":180,"viewableHeight":2.4,"screenBottom":0.35,
    "simulatorType":"airliner","mountingStyle":"ceiling","notes":"Email size acceptance",
    "room":{"width":6,"depth":6,"height":3.2},
    "projectors":[
      {"id":"P1","position":[-1.1,2.8,-2.2],"yaw":8,"pitch":-4,"roll":0,"throwRatio":0.69},
      {"id":"P2","position":[0,2.8,-2.3],"yaw":0,"pitch":-4,"roll":0,"throwRatio":0.69},
      {"id":"P3","position":[1.1,2.8,-2.2],"yaw":-8,"pitch":-4,"roll":0,"throwRatio":0.69}
    ]
  },
  "quote":{"reference":"SWX-PROJ-V57-TEST","date":"2026-10-26","lineItems":[{"id":"screen","label":"Projection screen and frame","amount":12000,"status":"priced"}]}
}

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    p=b.new_page(viewport={"width":1440,"height":950})
    p.add_init_script("""
      window.turnstile={
        render:(el,opts)=>{
          const input=document.createElement('input');
          input.type='hidden';input.name='cf-turnstile-response';input.value='test-turnstile-token';
          el.appendChild(input);setTimeout(()=>opts.callback?.('test-turnstile-token'),0);return 77;
        },
        getResponse:id=>id===77?'test-turnstile-token':'',
        reset:()=>{}
      };
    """)
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1800)
    p.evaluate("""snap=>{
      window.SimworxProjection={snapshot:()=>snap};
      document.querySelectorAll('[data-guided-go]').forEach(b=>b.removeAttribute('aria-current'));
      document.querySelector('[data-guided-go="4"]').setAttribute('aria-current','step');
    }""",snapshot)
    p.wait_for_timeout(1200)

    # Provide deterministic large image data to prove email compaction works.
    p.evaluate("""() => {
      const c=document.createElement('canvas');c.width=1200;c.height=800;
      const x=c.getContext('2d');x.fillStyle='#ddd';x.fillRect(0,0,c.width,c.height);
      for(let i=0;i<120;i++){x.fillStyle='rgb('+((i*31)%255)+','+((i*53)%255)+','+((i*71)%255)+')';x.fillRect((i*97)%1200,(i*67)%800,260,180);}
      const d=c.toDataURL('image/jpeg',0.92);
      window.__projectionProposalViews=[
        {view:'perspective',label:'3D perspective',data:d},
        {view:'front',label:'Front elevation',data:d},
        {view:'top',label:'Top plan',data:d},
        {view:'side',label:'Side elevation',data:d}
      ];
    }""")

    p.locator('#v37-email-proposal').click();p.wait_for_timeout(250)
    p.locator('#v37-email-address').fill('test@example.com')
    p.locator('#v37-email-name').fill('Test')

    p.evaluate("""() => {
      window.__v57Payload=null;
      const native=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{
        if(String(input).includes('projection-quote-submit.php')){
          const entries={};
          for(const [k,v] of init.body.entries())entries[k]=typeof v==='string'?v:'[blob]';
          window.__v57Payload=entries;
          return new Response(JSON.stringify({ok:true,message:'Proposal sent successfully.',reference:'SWX-PROJ-V57-TEST'}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return native(input,init);
      };
    }""")
    p.locator('#v37-email-send').click();p.wait_for_timeout(1400)
    payload=p.evaluate("window.__v57Payload")
    assert payload, "Email fetch not reached"
    html=payload.get('proposal_html','')
    total=sum(len(v.encode('utf-8')) for v in payload.values() if isinstance(v,str))
    imgs=html.count('data:image/jpeg;base64,')
    print("V57_EMAIL_PAYLOAD",{"bytes":total,"html_bytes":len(html.encode('utf-8')),"images":imgs})
    assert imgs>=4
    assert total<900000,total
    assert "System specification" in html and "Commercial proposal" in html

    # Ensure print path still uses normal proposal views and was not changed.
    assert p.locator('#projection-v52-proposal-views').count()==1
    b.close()

print("V57 EMAIL PAYLOAD SIZE ACCEPTANCE PASS")
