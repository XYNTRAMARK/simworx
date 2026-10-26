from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v66.html"
snapshot={
  "configuration":{"currency":"GBP","diameter":4.5,"horizontalFov":180,"viewableHeight":2.4,"screenBottom":0.35,"simulatorType":"airliner","mountingStyle":"ceiling","room":{"width":6,"depth":6,"height":3.2},"projectors":[]},
  "quote":{"reference":"SWX-PROJ-V66-TEST","date":"2026-10-26","lineItems":[{"id":"screen","label":"Projection screen and frame","amount":12000,"status":"priced"}]}
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
    # Exercise the real configurator flow so the private proposalViews state is populated.
    p.locator('[data-guided-go="2"]').click();p.wait_for_timeout(500)
    p.locator('[data-guided-go="3"]').click();p.wait_for_timeout(600)
    calc=p.locator('#guided-calculate')
    calc.click()
    for _ in range(300):
        if p.locator('#guided-result').is_visible() and not calc.is_disabled(): break
        p.wait_for_timeout(100)
    p.wait_for_timeout(700)
    p.locator('[data-guided-go="4"]').click();p.wait_for_timeout(1200)
    if p.locator('#v39-country').count(): p.locator('#v39-country').select_option('GB')
    if p.locator('#v37-customer-type').count(): p.locator('#v37-customer-type').select_option('business')
    p.wait_for_timeout(250)
    p.locator('#v37-email-proposal').click();p.wait_for_timeout(300)
    p.locator('#v37-email-address').fill('test@example.com')
    p.locator('#v37-email-name').fill('LED Pattern Test')

    p.evaluate("""() => {
      window.__v66=null;
      const native=window.fetch.bind(window);
      window.fetch=async(input,init={})=>{
        if(String(input).includes('projection-quote-submit.php')){
          const e={};
          for(const [k,v] of init.body.entries())e[k]=typeof v==='string'?v:'[blob]';
          window.__v66=e;
          return new Response(JSON.stringify({ok:true,reference:'SWX-PROJ-V66-TEST'}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return native(input,init);
      };
    }""")
    p.locator('#v37-email-send').click();p.wait_for_timeout(1000)
    payload=p.evaluate("window.__v66")
    if not payload:
        state=p.evaluate("""() => ({
          token:document.querySelector('#v48-email-form [name="cf-turnstile-response"]')?.value||'',
          status:document.getElementById('v37-email-status')?.textContent||'',
          proposal:document.getElementById('v37-proposal-status')?.textContent||'',
          views:(window.__projectionProposalViews||[]).map(v=>({view:v.view,len:v.data?.length||0}))
        })""")
        raise AssertionError(state)
    assert payload.get('quote_action')=='email',payload
    assert payload.get('cf-turnstile-response')=='token',payload
    assert 'projection_images' in payload
    assert 'data:image/jpeg;base64,' in payload['projection_images']
    assert 'data:image/jpeg;base64,' not in payload['proposal_html']
    assert 'cid:projection-view-1@sim-worx.com' in payload['proposal_html']
    assert 'sent successfully' in (p.locator('#v37-proposal-status').text_content() or '').lower()
    b.close()

print("V66 LED-PATTERN PROJECTION EMAIL CLIENT PASS")
