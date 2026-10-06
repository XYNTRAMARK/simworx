(() => {
  const el=document.getElementById('sw-global-footer');
  if(!el) return;
  el.className='sw-global-footer';
  el.innerHTML=`<div class="sw-footer-shell"><div class="sw-footer-grid">
    <section class="sw-footer-brand"><div class="sw-footer-brandname">SIMWORX Flight Simulators SLU</div><p class="sw-footer-desc">Professional flight simulation systems designed and built in Murcia, Spain for training, research, defence and immersive aviation applications.</p><div class="sw-footer-company">P.I. La Hoya<br>30816 Lorca, Murcia<br>Spain<br>NIF: B09869157</div></section>
    <section><h4>SOLUTIONS</h4><a href="simulators.html">Flight Simulators</a><a href="mission-systems.html">Mission Systems</a><a href="software.html">Software</a><a href="frames.html">Cockpit Shells &amp; Frames</a><a href="visual-systems.html">Visual Systems</a><a href="custom-simulator.html">Custom Simulators</a></section>
    <section><h4>COMPANY</h4><a href="about.html">About Us</a><a href="projects.html">Previous Builds</a><a href="contact.html">Contact</a></section>
    <section><h4>SUPPORT</h4><a href="simstarter.html">SimStarter Pro</a></section>
    <section class="sw-footer-contact"><h4>CONTACT</h4><a href="tel:+34868480623">+34 868 480 623</a><a href="mailto:info@sim-worx.com">info@sim-worx.com</a></section>
    <section class="sw-footer-legal"><h4>LEGAL</h4><a href="legal-notice.html">Legal Notice</a><a href="privacy-policy.html">Privacy Notice</a><a href="terms-and-conditions.html">Terms and Conditions</a><a href="cookie-notice.html">Cookie Notice</a><button class="sw-cookie-settings-link" data-swx-cookie-settings type="button">Cookie settings</button></section>
  </div><div class="sw-footer-bottom"><div class="sw-footer-copy">© 2026 SIMWORX Flight Simulators SLU. All rights reserved.</div><div class="sw-footer-trademark">All third-party trademarks, aircraft names and product names are the property of their respective owners. Their use is for identification purposes only and does not imply affiliation, approval or endorsement.</div></div></div>`;

  const source=document.currentScript&&document.currentScript.src;
  if(!source) return;

  if(!document.getElementById('swx-cookie-consent-css')){
    const stylesheet=document.createElement('link');
    stylesheet.id='swx-cookie-consent-css';
    stylesheet.rel='stylesheet';
    stylesheet.href=new URL('../css/cookie-consent.css?v=1',source).href;
    document.head.appendChild(stylesheet);
  }

  if(window.SimworxCookieConsent){
    window.SimworxCookieConsent.init();
    return;
  }

  if(!document.getElementById('swx-cookie-consent-js')){
    const script=document.createElement('script');
    script.id='swx-cookie-consent-js';
    script.src=new URL('cookie-consent.js?v=1',source).href;
    script.onload=()=>window.SimworxCookieConsent&&window.SimworxCookieConsent.init();
    document.head.appendChild(script);
  }
})();
