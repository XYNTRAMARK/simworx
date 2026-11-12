"""V0.2 browser checks for version label, CRUD, WBS and archive/restore."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import runpy
_smoke=runpy.run_path(str(Path(__file__).with_name('browser-smoke.py')))
bundle=_smoke['bundle']
ROOT=_smoke['ROOT']

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1540,'height':920},accept_downloads=True)
  page.on('dialog',lambda d:d.accept())
  errors=[];page.on('pageerror',lambda err: errors.append(str(err)))
  page.set_content('<style>'+ (ROOT/'styles.css').read_text()+'</style><div id="app"></div>')
  page.evaluate(bundle())
  assert page.locator('.version-chip').inner_text()=='V0.2.0'
  # Project edit
  page.locator('.sidebar [data-action=nav][data-id=projects]').click()
  page.locator('[data-action=edit-project]').first.click()
  form=page.locator('form[data-form=project]')
  assert 'NOAH' in form.locator('[name=name]').input_value()
  form.locator('[name=name]').fill('NOAH Demonstrator — Edited')
  form.locator('button[type=submit]').click()
  assert 'NOAH Demonstrator — Edited' in page.locator('.project-hero').inner_text()
  # Add a section, a parent job and a child job
  page.locator('[data-action=add-section]').click()
  sec=page.locator('form[data-form=section]')
  sec.locator('[name=name]').fill('Pilot seat and centre console')
  sec.locator('button[type=submit]').click()
  assert 'Pilot seat and centre console' in page.locator('.hierarchy').inner_text()
  page.locator('[data-action=open-task-modal]').last.click()
  f=page.locator('form[data-form=task]')
  f.locator('[name=title]').fill('Fabricate mounting structure')
  f.locator('[name=sectionId]').select_option(label='Pilot seat and centre console')
  f.locator('button[type=submit]').click()
  assert 'Fabricate mounting structure' in page.locator('.hierarchy').inner_text()
  page.locator('.wbs-tree-node').filter(has_text='Fabricate mounting structure').last.locator('[data-action=add-subtask]').first.click()
  f=page.locator('form[data-form=task]')
  f.locator('[name=title]').fill('Cut centre console brackets')
  assert f.locator('[name=parentId]').input_value()!=''
  assert f.locator('[name=sectionId]').input_value()!=''
  f.locator('button[type=submit]').click()
  assert 'Cut centre console brackets' in page.locator('.hierarchy').inner_text()
  # Edit and archive a nested child (requires no dependents)
  child=page.locator('.wbs-tree-node').filter(has_text='Cut centre console brackets').last
  child.locator('[data-action=edit-task]').first.click()
  f=page.locator('form[data-form=task]');f.locator('[name=assignee]').fill('Workshop Manager')
  f.locator('button[type=submit]').click()
  assert 'Workshop Manager' in page.locator('.hierarchy').inner_text()
  child=page.locator('.wbs-tree-node').filter(has_text='Cut centre console brackets').last
  child.locator('[data-action=archive-record]').first.click()
  assert 'Cut centre console brackets' not in page.locator('.hierarchy').inner_text()
  # Undo archive via settings
  page.locator('[data-action=nav][data-id=settings]').click()
  assert 'Cut centre console brackets' in page.locator('.archive-row').first.inner_text()
  page.locator('[data-action=restore-record]').first.click()
  assert page.locator('.archive-row').count()==0
  # BOM add and edit
  page.locator('.sidebar [data-action=nav][data-id=projects]').click()
  page.locator('[data-action=project-tab][data-id=bom]').click()
  before=page.locator('.table tbody tr').count()
  page.locator('[data-action=add-bom]').click()
  f=page.locator('form[data-form=bom]')
  f.locator('[name=partId]').select_option(label='SW-CAB-024 · Shielded signal cable (24 core)')
  f.locator('[name=required]').fill('4')
  f.locator('button[type=submit]').click()
  assert page.locator('.table tbody tr').count()==before+1
  page.locator('[data-action=edit-bom]').last.click()
  f=page.locator('form[data-form=bom]');f.locator('[name=required]').fill('6');f.locator('button[type=submit]').click()
  assert not errors, errors
  # WBS CSV download
  page.locator('[data-action=project-tab][data-id=structure]').click()
  with page.expect_download() as download_info:
   page.locator('[data-action=export-wbs]').click()
  download=download_info.value
  assert download.suggested_filename.endswith('-WBS.csv')
  # customer edit
  page.locator('[data-action=nav][data-id=customers]').click()
  page.locator('[data-action=edit-customer]').first.click()
  f=page.locator('form[data-form=customer]')
  f.locator('[name=name]').fill('NOAH USA DEMO')
  f.locator('button[type=submit]').click()
  assert 'NOAH USA DEMO' in page.locator('.customer-grid').inner_text()
  page.screenshot(path='/mnt/data/SimWorx_Project_Hub_v02_Customers.png',full_page=True)
  page.locator('.sidebar [data-action=nav][data-id=projects]').click()
  page.screenshot(path='/mnt/data/SimWorx_Project_Hub_v02_WBS.png',full_page=True)
  assert not errors,errors
  print('PASS: V0.2 browser CRUD, version, WBS nesting, archive/restore, BOM, CSV, customer edits')
  browser.close()
if __name__=='__main__':run()