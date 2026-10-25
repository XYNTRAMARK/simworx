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
          const q=s=>document.querySelector(s);
          const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom}};
          const css=e=>{if(!e)return null;const s=getComputedStyle(e);return {position:s.position,top:s.top,left:s.left,right:s.right,width:s.width,margin:s.margin,padding:s.padding,lineHeight:s.lineHeight,overflowX:s.overflowX,overflowY:s.overflowY,zIndex:s.zIndex}};
          const h=q('.global-header'),m=q('#projection-app'),p=q('.led-estimate-bar'),g=q('#v40-guided-header');
          return {header:r(h),main:r(m),price:r(p),guide:r(g),
            headerStyle:css(h),priceStyle:css(p),mainStyle:css(m),guideStyle:css(g),
            guideParent:g?{tag:g.parentElement?.tagName,id:g.parentElement?.id,cls:g.parentElement?.className}:null};
        }""")

    top=metrics()
    print("TOP_METRICS",top)
    print("DOM_DIAGNOSTIC",page.evaluate("""() => {
      const textRect=n=>{try{const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}}catch(_){return null}};
      const node=n=>({type:n.nodeType,name:n.nodeName,text:n.nodeType===3?JSON.stringify(n.textContent):null,rect:n.nodeType===3?textRect(n):(n.getBoundingClientRect?(()=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})():null)});
      const before=getComputedStyle(document.body,'::before'),after=getComputedStyle(document.body,'::after');
      return {
        body:{lineHeight:getComputedStyle(document.body).lineHeight,fontSize:getComputedStyle(document.body).fontSize,display:getComputedStyle(document.body).display},
        bodyBefore:{content:before.content,display:before.display,height:before.height,margin:before.margin,padding:before.padding},
        bodyAfter:{content:after.content,display:after.display,height:after.height},
        childNodes:Array.from(document.body.childNodes).slice(0,12).map(node),
        headerPrevious:{type:document.querySelector('.global-header')?.previousSibling?.nodeType,name:document.querySelector('.global-header')?.previousSibling?.nodeName,text:document.querySelector('.global-header')?.previousSibling?.textContent}
      };
    }"""))
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
