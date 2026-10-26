from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v56.html"

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

    captured={"errors":[]}

    page.on("console",lambda msg: captured["errors"].append("console "+msg.type+": "+msg.text) if msg.type in ["error","warning"] else None)
    page.on("pageerror",lambda exc: captured["errors"].append("pageerror: "+str(exc)))
    page.on("requestfailed",lambda req: captured["errors"].append("requestfailed: "+req.url+" "+str(req.failure)))
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    page.wait_for_timeout(1200)
    assert page.locator('meta[http-equiv="Content-Security-Policy"]').count()==0
    page.evaluate("""() => {
      window.__v48FetchTrace=[];
      window.__v48CapturedPayload={};
      const nativeFetch=window.fetch.bind(window);
      window.fetch=async function(input,init={}){
        const url=String(input);
        if(url.includes('projection-quote-submit.php')){
          const entries={};
          if(init.body instanceof FormData){
            for(const [key,value] of init.body.entries()){
              entries[key]=typeof value==='string'?value:'[blob]';
            }
          }
          window.__v48CapturedPayload=entries;
          window.__v48FetchTrace.push({url,started:true,status:200,ok:true,keys:Object.keys(entries)});
          return new Response(JSON.stringify({ok:true,message:'Proposal sent successfully.',reference:'SWX-PROJ-V48-TEST'}),{
            status:200,
            headers:{'Content-Type':'application/json'}
          });
        }
        return nativeFetch(input,init);
      };
      const form=document.getElementById('v48-email-form');
      window.__v48SubmitTrace=[];
      form?.addEventListener('submit',e=>window.__v48SubmitTrace.push({phase:'capture-observer',defaultPrevented:e.defaultPrevented}),true);
      form?.addEventListener('submit',e=>window.__v48SubmitTrace.push({phase:'bubble-observer',defaultPrevented:e.defaultPrevented}));
    }""")

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
    print_text=page.locator("#projection-print-document").text_content() or ""
    print_status=page.locator("#v37-proposal-status").text_content() or ""
    print("PRINT_STATUS",print_status)
    print("PRINT_TEXT_START",print_text[:1200])
    assert "Simworx Projection System Proposal" in print_text, (print_status,print_text[:500])
    assert "System specification" in print_text
    assert "Projector requirement" in print_text
    assert "Commercial proposal" in print_text
    assert page.evaluate("window.__printCalled===true")
    assert page.locator("#v42-print-frame").count()==0
    page.emulate_media(media="print")
    print_box=page.locator("#projection-print-document").bounding_box()
    assert print_box and print_box["width"]>500 and print_box["height"]>300, print_box
    assert page.locator("#projection-print-document").is_visible()
    page.emulate_media(media="screen")
    print("PDF_DELIVERY_PASS",len(print_text),print_box)

    # Email path: exact LED protection controller must have populated the form.
    page.locator("#v37-email-proposal").click()
    page.wait_for_timeout(200)
    assert page.locator("#v37-email-dialog").is_visible()
    assert page.locator("#v48-email-form .sw-form-verification").count()==1
    assert page.locator('#v48-email-form [name="cf-turnstile-response"]').input_value()=="test-turnstile-token"
    page.locator("#v37-email-address").fill("mark@sim-worx.com")
    page.locator("#v37-email-name").fill("Mark")
    print("EMAIL_BEFORE_SUBMIT",page.evaluate("""() => ({
      status:document.getElementById('v37-email-status')?.textContent||'',
      buttonDisabled:document.getElementById('v37-email-send')?.disabled,
      token:document.querySelector('#v48-email-form [name="cf-turnstile-response"]')?.value||'',
      formAction:document.getElementById('v48-email-form')?.action,
      dialogOpen:document.getElementById('v37-email-dialog')?.open
    })"""))
    page.locator("#v37-email-send").click()
    page.wait_for_timeout(1000)

    status=page.locator("#v37-proposal-status").text_content() or ""
    email_status=page.locator("#v37-email-status").text_content() or ""
    trace=page.evaluate("({fetch:window.__v48FetchTrace,submit:window.__v48SubmitTrace,payload:window.__v48CapturedPayload})")
    print("EMAIL_AFTER_SUBMIT",{"proposal_status":status,"email_status":email_status,"trace":trace,"errors":captured.get("errors"),"url":page.url})
    assert "sent successfully" in status.lower(), (status,email_status,trace,captured.get("errors"),page.url)
    payload=trace["payload"]
    assert payload.get("cf-turnstile-response")=="test-turnstile-token", payload
    assert payload.get("proposal_reference")=="SWX-PROJ-V48-TEST", payload
    assert "System specification" in payload.get("proposal_html","")
    assert "Commercial proposal" in payload.get("proposal_html","")
    assert "SPECIFICATION" in payload.get("proposal_text","")
    assert payload.get("email")=="mark@sim-worx.com"
    print("EMAIL_DELIVERY_PASS",status)

    browser.close()

print("V56 INHERITED PROPOSAL DELIVERY ACCEPTANCE PASS")
