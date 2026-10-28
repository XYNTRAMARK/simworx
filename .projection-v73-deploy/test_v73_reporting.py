from playwright.sync_api import sync_playwright
import json

URL="http://127.0.0.1:8765/projection-screen-configurator-v73.html"
def event_names(payloads):
    names=[]
    for raw in payloads:
        try:
            body=json.loads(raw or '{}')
            names += [e.get('event_name') for e in body.get('events',[])]
        except: pass
    return names

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    p=b.new_page(viewport={"width":1600,"height":1000})
    p.add_init_script("""
      window.turnstile={
        render:(el,opts)=>{const i=document.createElement('input');i.type='hidden';i.name='cf-turnstile-response';i.value='token';el.appendChild(i);setTimeout(()=>opts.callback?.('token'),0);return 7},
        getResponse:id=>id===7?'token':'',reset:()=>{}
      };
    """)
    intelligence=[];mail=[]
    def route_handler(route,request):
        url=request.url
        if 'functions/v1/simworx-intelligence' in url:
            intelligence.append(request.post_data or '')
            route.fulfill(status=200,content_type='application/json',body='{"ok":true,"accepted":20}')
        elif 'led-quote-submit.php' in url:
            mail.append(request.post_data or '')
            route.fulfill(status=200,content_type='application/json',body='{"ok":true,"reference":"SWX-PROJ-V73-TEST"}')
        else: route.continue_()
    p.route("**/*",route_handler)
    p.goto(URL,wait_until="domcontentloaded",timeout=60000);p.wait_for_timeout(1600)
    p.wait_for_function("() => !!window.SimworxIntelligence",timeout=10000)
    p.evaluate("window.SimworxIntelligence.setConsent({analytics:true})");p.wait_for_timeout(300)

    # Create a real configuration and reach Proposal.
    p.locator('[data-guided-go="2"]').click();p.wait_for_timeout(400)
    p.locator('[data-guided-go="3"]').click();p.wait_for_timeout(500)
    calc=p.locator('#guided-calculate');calc.click()
    for _ in range(250):
        if p.locator('#guided-result').is_visible() and not calc.is_disabled(): break
        p.wait_for_timeout(100)
    p.wait_for_timeout(500)
    p.locator('[data-guided-go="4"]').click();p.wait_for_timeout(900)
    if p.locator('#v39-country').count():p.locator('#v39-country').select_option('GB')
    if p.locator('#v37-customer-type').count():p.locator('#v37-customer-type').select_option('business')

    # PDF: stub rendering libraries only; execute the live Save PDF UI path.
    p.evaluate("""() => {
      window.__savedPdf='';
      window.html2canvas=async()=>({width:794,height:1123,toDataURL:()=> 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q=='});
      class FakePdf{addImage(){} addPage(){} save(n){window.__savedPdf=n}}
      window.jspdf={jsPDF:FakePdf};
    }""")
    p.locator('#v65-save-pdf').click();p.wait_for_timeout(100)
    p.locator('#v65-save-email').fill('mark@sim-worx.com')
    p.locator('#v65-save-confirm').click();p.wait_for_timeout(1300)
    p.evaluate("window.SimworxIntelligence.flush()");p.wait_for_timeout(500)
    names=event_names(intelligence)
    print("V73_PDF_EVENTS",names)
    assert 'configuration_downloaded' in names,names
    assert 'email_entered' in names,names

    # Email: use live dialog, mocked mail endpoint, and inspect actual intelligence events.
    p.locator('#v37-email-proposal').click();p.wait_for_timeout(150)
    p.locator('#v37-email-address').fill('mark@sim-worx.com')
    p.locator('#v37-email-name').fill('Mark')
    p.locator('#v37-email-send').click();p.wait_for_timeout(1800)
    p.evaluate("window.SimworxIntelligence.flush()");p.wait_for_timeout(500)
    names=event_names(intelligence)
    print("V73_EMAIL_EVENTS",names)
    assert mail, "Email POST did not execute"
    assert 'configuration_emailed' in names,names
    assert 'email_entered' in names,names
    b.close()
print("V73_REPORTING_OUTCOMES_PASS")
