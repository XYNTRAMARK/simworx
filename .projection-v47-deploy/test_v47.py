from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v47.html"

def close(a,b,tol=2):
    return abs(a-b)<=tol

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1680,"height":900})
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    page.wait_for_timeout(1800)

    assert page.locator("body").get_attribute("class")=="led-page"
    assert page.locator("#projection-offline-banner").count()==0

    def metrics():
        return page.evaluate("""() => {
          const q=s=>document.querySelector(s), r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom}};
          const h=q('.global-header'),m=q('#projection-app'),p=q('.led-estimate-bar'),g=q('#v40-guided-header');
          return {header:r(h),main:r(m),price:r(p),guide:r(g),
            hs:getComputedStyle(h), ps:getComputedStyle(p), ms:getComputedStyle(m)};
        }""")

    top=metrics()
    assert close(top["header"]["x"],0)
    assert close(top["header"]["y"],0)
    assert close(top["header"]["width"],1680)
    assert close(top["header"]["height"],84)
    assert close(top["main"]["x"],250)
    assert close(top["main"]["width"],1180)
    assert close(top["price"]["x"],250)
    assert close(top["price"]["width"],1180)

    page.evaluate("window.scrollTo(0,900)")
    page.wait_for_timeout(350)
    sc=metrics()
    assert close(sc["header"]["y"],0), sc
    assert close(sc["price"]["y"],84), sc
    expected_guide=84+sc["price"]["height"]
    assert close(sc["guide"]["y"],expected_guide,3), (sc,expected_guide)
    assert close(sc["guide"]["x"],250)
    assert close(sc["guide"]["width"],1180)

    page.screenshot(path="/tmp/v47-scroll-proof.png",full_page=False)
    browser.close()

print("V47 runtime geometry PASS: header sticky, centred 1180 shell, price sticky directly below header")
