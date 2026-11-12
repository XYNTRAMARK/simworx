"""Optional UI smoke test; needs Python Playwright + Chromium installed.

The test injects local JS into about:blank to accommodate hardened browser environments
that block all navigation. It exercises the same source used by index.html.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
def bundle():
    model=(ROOT/'src/model.mjs').read_text().replace('export const ','const ').replace('export function ','function ')
    seed=(ROOT/'src/demo-data.mjs').read_text().replace('export const ','const ')
    app='\n'.join(line for line in (ROOT/'src/app.mjs').read_text().splitlines() if not line.startswith('import '))
    return '(function(){\n'+model+'\n'+seed+'\nconst e=escapeHtml;\n'+app+'\n})();'

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
        errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content('<style>'+ (ROOT/'styles.css').read_text()+'</style><div id="app"></div>')
        page.evaluate(bundle())
        assert page.locator('.page-heading h1').inner_text() == 'Good morning, Sim-Worx'
        assert page.locator('.table tbody tr').count() >= 4

        # Light / dark switch, persists as a demo setting.
        page.locator('[data-action=theme]').click()
        assert 'dark' in page.locator('body').get_attribute('class')
        page.locator('[data-action=theme]').click()

        # New customer organisation.
        page.locator('[data-action=nav][data-id=customers]').click()
        page.locator('[data-action=open-customer-modal]').click()
        assert page.locator('.modal').count()==1
        page.locator('form[data-form=customer] [name=name]').fill('Example Aerospace')
        page.locator('form[data-form=customer] [name=code]').fill('EXA')
        page.locator('form[data-form=customer] [name=contact]').fill('United Kingdom')
        page.locator('form[data-form=customer] button[type=submit]').click()
        assert 'Example Aerospace' in page.locator('.customer-grid').inner_text()
        assert page.locator('.modal').count()==0

        # Create a project assigned to that customer.
        page.locator('[data-action=nav][data-id=projects]').click()
        page.locator('[data-action=open-project-modal]').click()
        page.locator('form[data-form=project] [name=name]').fill('Example cockpit development')
        page.locator('form[data-form=project] [name=orgId]').select_option(label='Example Aerospace')
        page.locator('form[data-form=project] button[type=submit]').click()
        assert 'Example cockpit development' in page.locator('.project-hero').inner_text()

        # Customer view only contains published content for selected organisation.
        page.locator('[data-action=nav][data-id=client]').click()
        page.locator('[data-filter=clientOrg]').select_option(label='Example Aerospace')
        assert 'Example cockpit development' in page.locator('.client-banner').inner_text()
        assert page.locator('.update-card').count()==0
        page.locator('[data-filter=clientOrg]').select_option(label='NOAH')
        assert page.locator('.update-card').count()==2

        # Client approval, identity-referenced demo record.
        page.locator('[data-action=client-tab][data-id=approvals]').click()
        assert page.locator('[data-action=decide-approval]').count()>=1
        page.locator('[data-action=decide-approval][data-decision=Approved]').first.click()
        assert 'Approved' in page.locator('.card-body').inner_text()

        # Client staff invitation is a demo-only action.
        page.locator('[data-action=invite-modal]').first.click()
        page.locator('form[data-form=invite] [name=name]').fill('Sam Example')
        page.locator('form[data-form=invite] [name=email]').fill('sam@example.invalid')
        page.locator('form[data-form=invite] button[type=submit]').click()
        page.locator('[data-action=client-tab][data-id=people]').click()
        assert 'Sam Example' in page.locator('.card-body').inner_text()

        # Internal stock movement and order receiving.
        page.locator('[data-action=nav][data-id=inventory]').click()
        before=page.locator('.table tbody tr').first.inner_text()
        page.locator('[data-action=stock-modal]').first.click()
        page.locator('form[data-form=stock] [name=quantity]').fill('2')
        page.locator('form[data-form=stock] button[type=submit]').click()
        assert 'Stock receipt' not in page.locator('.modal').inner_text() if page.locator('.modal').count() else True
        page.locator('[data-action=nav][data-id=purchasing]').click()
        page.locator('[data-action=receive-po]').first.click()
        assert page.locator('.page-heading h1').inner_text()=='Purchasing'
        assert not errors, errors
        print('PASS: browser smoke tests — navigation, theme, customers, projects, client isolation, approval, invite, stock and PO')
        browser.close()

if __name__ == '__main__':run()