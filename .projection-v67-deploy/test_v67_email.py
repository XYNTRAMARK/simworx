from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v67.html"

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    p=b.new_page(viewport={"width":1680,"height":1050})
    p.add_init_script("""
      window.turnstile={
        render:(el,opts)=>{const i=document.createElement('input');i.type='hidden';i.name='cf-turnstile-response';i.value='token';el.appendChild(i);setTimeout(()=>opts.callback?.('token'),0);return 7},
        getResponse:id=>id===7?'token':'',reset:()=>{}
      };
    """)
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1500)

    # Real workflow populates private proposalViews.
    p.locator('[data-guided-go="2"]').click();p.wait_for_timeout(450)
    p.locator('[data-guided-go="3"]').click();p.wait_for_timeout(600)
    calc=p.locator('#guided-calculate');calc.click()
    for _ in range(300):
        if p.locator('#guided-result').is_visible() and not calc.is_disabled(): break
        p.wait_for_timeout(100)
    p.wait_for_timeout(700)
    p.locator('[data-guided-go="4"]').click();p.wait_for_timeout(1200)
    if p.locator('#v39-country').count():p.locator('#v39-country').select_option('GB')
    if p.locator('#v37-customer-type').count():p.locator('#v37-customer-type').select_option('business')
    p.wait_for_timeout(250)

    p.locator('#v37-email-proposal').click();p.wait_for_timeout(300)
    p.locator('#v37-email-address').fill('test@example.com')
    p.locator('#v37-email-name').fill('Payload Cap Test')

    p.evaluate("""() => {
      window.__v67=null;
      const native=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{
        if(String(input).includes('projection-quote-submit.php')){
          const e={};let total=0;
          for(const [k,v] of init.body.entries()){
            const s=typeof v==='string'?v:'[blob]';
            e[k]=s;total+=new TextEncoder().encode(s).length;
          }
          window.__v67={entries:e,total};
          return new Response(JSON.stringify({ok:true,reference:'SWX-PROJ-V67-TEST'}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return native(input,init);
      };
    }""")
    p.locator('#v37-email-send').click();p.wait_for_timeout(1600)
    data=p.evaluate("window.__v67")
    assert data,data
    images=data['entries'].get('projection_images','')
    print("V67_PAYLOAD",{"total":data["total"],"imagesBytes":len(images.encode()),"htmlBytes":len(data["entries"].get("proposal_html","").encode())})
    assert len(images.encode())<=650000,len(images.encode())
    assert data["total"]<900000,data["total"]
    assert 'data:image/jpeg;base64,' not in data['entries'].get('proposal_html','')
    assert data['entries'].get('quote_action')=='email'
    b.close()

print("V67 PROJECTION EMAIL HARD PAYLOAD CAP PASS")
