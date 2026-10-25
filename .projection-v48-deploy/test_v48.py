from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v48.html"

snapshot={
  "configuration":{
    "currency":"GBP","diameter":4.5,"horizontalFov":180,"viewableHeight":2.4,"screenBottom":0.35,
    "simulatorType":"airliner","mountingStyle":"ceiling","notes":"Acceptance test proposal",
    "room":{"width":6,"depth":6,"height":3.2},
    "projectors":[
      {"id":"P1","position":[-1.1,2.8,-2.2],"yaw":8,"pitch":-4,"roll":0,"throwRatio":0.69},
      {"id":"P2","position":[0,2.8,-2.3],"yaw":0,"pitch":-4,"roll":0,"throwRatio":0.69},
      {"id":"P3","position":[1.1,2.8,-2.2],"yaw":-8,"pitch":-4,"roll":0,"throwRatio":0.69}
    ]
  },
  "quote":{
    "reference":"SWX-PROJ-V48-TEST","date":"2026-10-25",
    "lineItems":[
      {"id":"screen","label":"Projection screen and frame","amount":12000,"status":"priced"},
      {"id":"warping","label":"Warping / calibration package","amount":1500,"status":"priced"}
    ]
  }
}

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1440,"height":950})

    # Stub the third-party widget, but exercise the exact copied LED controller.
    page.add_init_script("""
      window.__printCalled=false;
      window.print=()=>{window.__printCalled=true};
      window.turnstile={
        render:(el,opts)=>{
          const input=document.createElement('input');
          input.type='hidden';input.name='cf-turnstile-response';input.value='test-turnstile-token';
          el.appendChild(input);
          setTimeout(()=>opts.callback?.('test-turnstile-token'),0);
          return 77;
        },
        getResponse:(id)=>id===77?'test-turnstile-token':'',
        reset:()=>{}
      };
    """)

    captured={}
    def route_handler(route):
        captured['body']=route.request.post_data or ''
        route.fulfill(status=200,content_type="application/json",body='{"ok":true,"message":"Proposal sent successfully.","reference":"SWX-PROJ-V48-TEST"}')
    page.route("**/projection-quote-submit.php",route_handler)

    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    page.wait_for_timeout(1200)

    page.evaluate("""snap=>{
      window.SimworxProjection={snapshot:()=>snap};
      document.querySelectorAll('[data-guided-go]').forEach(b=>b.removeAttribute('aria-current'));
      document.querySelector('[data-guided-go="4"]').setAttribute('aria-current','step');
    }""",snapshot)
    page.wait_for_timeout(700)

    assert page.locator("#v37-proposal").is_visible(), "Proposal did not open under mocked canonical snapshot"

    # PDF path: populate the real print document and call normal window.print.
    page.locator("#v37-print-proposal").click()
    page.wait_for_timeout(250)
    print_text=page.locator("#projection-print-document").inner_text()
    assert "Simworx Projection System Proposal" in print_text
    assert "System specification" in print_text
    assert "Projector requirement" in print_text
    assert "Commercial proposal" in print_text
    assert page.evaluate("window.__printCalled===true")
    assert page.locator("#v42-print-frame").count()==0
    print("PDF_DELIVERY_PASS",len(print_text))

    # Email path: exact LED protection controller must have populated the form.
    page.locator("#v37-email-proposal").click()
    page.wait_for_timeout(200)
    assert page.locator("#v37-email-dialog").is_visible()
    assert page.locator("#v48-email-form .sw-form-verification").count()==1
    assert page.locator('#v48-email-form [name="cf-turnstile-response"]').input_value()=="test-turnstile-token"
    page.locator("#v37-email-address").fill("mark@sim-worx.com")
    page.locator("#v37-email-name").fill("Mark")
    page.locator("#v37-email-send").click()
    page.wait_for_timeout(500)

    status=page.locator("#v37-proposal-status").inner_text()
    assert "sent successfully" in status.lower(), status
    body=captured.get('body','')
    assert 'test-turnstile-token' in body
    assert 'proposal_html' in body and 'proposal_text' in body and 'proposal_reference' in body
    print("EMAIL_DELIVERY_PASS",status)

    browser.close()

print("V48 PROPOSAL DELIVERY ACCEPTANCE PASS")
