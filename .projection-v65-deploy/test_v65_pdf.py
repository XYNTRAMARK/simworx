from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v65.html"

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1440,"height":950})
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1200)

    assert p.locator('#v65-save-pdf').inner_text()=='Save PDF'
    assert p.locator('#v37-print-proposal').inner_text()=='Print proposal'
    assert p.locator('#v37-email-proposal').count()==1

    # Save must gate on an email.
    p.locator('#v65-save-pdf').click()
    p.wait_for_timeout(100)
    assert p.locator('#v65-save-pdf-dialog').is_visible()
    assert p.locator('#v65-save-email').get_attribute('required') is not None

    # Stub only the PDF libraries to validate the direct-download flow deterministically.
    p.evaluate("""() => {
      window.__v65Saved='';
      window.html2canvas=async()=>({
        width:794,height:1123,
        toDataURL:()=> 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q=='
      });
      class FakePdf{
        addImage(){}
        addPage(){}
        save(name){window.__v65Saved=name}
      }
      window.jspdf={jsPDF:FakePdf};
      const source=document.getElementById('projection-print-document');
      source.innerHTML='<h1>Simworx Projection System Proposal</h1><h2>System specification</h2><p>Test</p><h2>Commercial proposal</h2><p>Test</p>';
      source.setAttribute('data-proposal-reference','SWX-PDF-TEST');
      window.print=()=>{};
    }""")

    # Bypass existing print generation only for this unit test because source is already populated.
    p.evaluate("""() => {
      const btn=document.getElementById('v37-print-proposal');
      btn.addEventListener('click',e=>e.stopImmediatePropagation(),true);
    }""")
    p.locator('#v65-save-email').fill('client@example.com')
    p.locator('#v65-save-confirm').click()
    p.wait_for_timeout(800)
    saved=p.evaluate("window.__v65Saved")
    remembered=p.evaluate("localStorage.getItem('simworxProjectionPdfEmail')")
    print("V65_SAVE",saved,remembered)
    assert saved=='Simworx_Projection_Proposal_SWX-PDF-TEST.pdf',saved
    assert remembered=='client@example.com'

    # Unrelated accepted UI remains.
    assert not p.locator('#guided-viewer-status').is_visible()
    assert not p.locator('.projection-material-bar').is_visible()
    assert p.locator('#v30-throw').count()==1

    b.close()

print("V65 TRUE PDF SAVE EMAIL GATE PASS")
