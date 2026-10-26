from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v61.html"
snapshot={
  "configuration":{"currency":"GBP","diameter":4.5,"horizontalFov":180,"viewableHeight":2.4,"screenBottom":0.35,"simulatorType":"airliner","mountingStyle":"ceiling","room":{"width":6,"depth":6,"height":3.2},"projectors":[]},
  "quote":{"reference":"SWX-PROJ-V61-TEST","date":"2026-10-26","lineItems":[{"id":"screen","label":"Projection screen and frame","amount":12000,"status":"priced"}]}
}

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1440,"height":950})
    p.add_init_script("""
      window.turnstile={
        render:(el,opts)=>{const i=document.createElement('input');i.type='hidden';i.name='cf-turnstile-response';i.value='token';el.appendChild(i);setTimeout(()=>opts.callback?.('token'),0);return 7},
        getResponse:id=>id===7?'token':'',reset:()=>{}
      };
    """)
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1200)
    p.evaluate("""snap=>{
      window.SimworxProjection={snapshot:()=>snap};
      document.querySelectorAll('[data-guided-go]').forEach(b=>b.removeAttribute('aria-current'));
      document.querySelector('[data-guided-go="4"]').setAttribute('aria-current','step');
    }""",snapshot)
    p.wait_for_timeout(700)

    # Deterministic high-detail image to stress JPEG size.
    p.evaluate("""() => {
      const c=document.createElement('canvas');c.width=1400;c.height=900;
      const x=c.getContext('2d');const im=x.createImageData(c.width,c.height);
      for(let i=0;i<im.data.length;i+=4){
        const n=(i*1103515245+12345)>>>0;
        im.data[i]=(n>>>16)&255;im.data[i+1]=(n>>>8)&255;im.data[i+2]=n&255;im.data[i+3]=255;
      }
      x.putImageData(im,0,0);
      const d=c.toDataURL('image/jpeg',0.95);
      window.__projectionProposalViews=[
        {view:'perspective',label:'3D perspective',data:d},
        {view:'front',label:'Front elevation',data:d},
        {view:'top',label:'Top plan',data:d},
        {view:'side',label:'Side elevation',data:d}
      ];
    }""")

    p.locator('#v37-email-proposal').click();p.wait_for_timeout(250)
    p.locator('#v37-email-address').fill('test@example.com')
    p.locator('#v37-email-name').fill('Stress Test')
    p.evaluate("""() => {
      window.__v61Payload=null;
      const native=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{
        if(String(input).includes('projection-quote-submit.php')){
          let total=0,html='';
          for(const [k,v] of init.body.entries()){
            const s=typeof v==='string'?v:'[blob]';
            total+=new TextEncoder().encode(s).length;
            if(k==='proposal_html')html=s;
          }
          window.__v61Payload={total,htmlBytes:new TextEncoder().encode(html).length,imageCount:(html.match(/data:image\/jpeg;base64,/g)||[]).length};
          return new Response(JSON.stringify({ok:true,reference:'STRESS'}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return native(input,init);
      };
    }""")
    p.locator('#v37-email-send').click();p.wait_for_timeout(2200)
    data=p.evaluate("window.__v61Payload")
    print("V61_STRESS_PAYLOAD",data)
    assert data and data["total"]<700000,data
    assert data["htmlBytes"]<660000,data

    # Non-email accepted UI remains inherited.
    assert not p.locator('.projection-material-bar').is_visible()
    assert p.locator('.led-estimate-bar').bounding_box()['height']<=92
    assert p.locator('#v30-throw').count()==1
    b.close()

print("V61 ADAPTIVE EMAIL PAYLOAD CAP PASS")
