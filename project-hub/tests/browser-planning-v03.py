"""V0.3 engineering planner: in-cell edits, schedule, baseline, material readiness, original CRUD."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from importlib.machinery import SourceFileLoader
import runpy
smoke=runpy.run_path(str(Path(__file__).with_name('browser-smoke.py')))
bundle=smoke['bundle'];ROOT=smoke['ROOT']

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1560,'height':1000},device_scale_factor=1,accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('dialog',lambda d:d.accept())
  page.set_content('<style>'+ (ROOT/'styles.css').read_text()+'</style><div id="app"></div>')
  page.evaluate(bundle())
  assert page.locator('.version-chip').inner_text()=='V0.3.0'
  page.locator('.sidebar [data-action=nav][data-id=projects]').click()
  page.locator('[data-action=project-tab][data-id=register]').click()
  assert page.locator('.work-sheet tbody tr').count()>=16
  row=page.locator('tr').filter(has_text='Weld cockpit frame').first
  assert row.locator('[data-field=assignee]').input_value()=='Marco Ferrer'
  row.locator('[data-field=assignee]').fill('Workshop Planner')
  row.locator('[data-field=assignee]').press('Tab')
  row=page.locator('tr').filter(has_text='Weld cockpit frame').first
  assert row.locator('[data-field=assignee]').input_value()=='Workshop Planner'
  row.locator('[data-field=start]').fill('2026-11-10')
  row.locator('[data-field=start]').press('Tab')
  row=page.locator('tr').filter(has_text='Weld cockpit frame').first
  assert row.locator('[data-field=start]').input_value()=='2026-11-10'
  # Invalid finish before start gets rejected, restoring valid input on rerender.
  row.locator('[data-field=due]').fill('2026-10-01')
  row.locator('[data-field=due]').press('Tab')
  row=page.locator('tr').filter(has_text='Weld cockpit frame').first
  assert row.locator('[data-field=due]').input_value()=='2026-11-21'
  assert 'Finish date' in page.locator('.toast').inner_text()
  page.locator('[data-action=project-tab][data-id=schedule]').click()
  assert page.locator('.gantt-chart .gantt-bar').count()>=8
  assert page.locator('.gantt-axis div').count()==16
  assert page.locator('.gantt-baseline').count()==0
  page.locator('[data-action=capture-baseline]').click()
  assert page.locator('.gantt-baseline').count()>=8
  assert 'Baseline captured' in page.locator('.baseline-note').inner_text()
  page.screenshot(path='/mnt/data/SimWorx_Project_Hub_V0.3.0_Gantt.png',full_page=True)
  # Reschedule edited job; real baseline remains and delay is reported.
  page.locator('.gantt-job').filter(has_text='Weld cockpit frame').locator('[data-action=edit-task]').click()
  form=page.locator('form[data-form=task]')
  form.locator('[name=due]').fill('2026-12-02')
  form.locator('button[type=submit]').click()
  assert '1' in page.locator('.plan-kpis').inner_text()
  assert page.locator('.plan-warning').count()>0
  page.locator('[data-action=project-tab][data-id=register]').click()
  with page.expect_download() as dl:
   page.locator('[data-action=export-wbs]').click()
  assert dl.value.suggested_filename.endswith('-WBS.csv')
  page.screenshot(path='/mnt/data/SimWorx_Project_Hub_V0.3.0_Register.png',full_page=True)
  page.locator('[data-action=project-tab][data-id=materials]').click()
  assert 'Potential shortfall' in page.locator('.plan-kpis').inner_text()
  assert page.locator('.table tbody tr').count()>=5
  page.screenshot(path='/mnt/data/SimWorx_Project_Hub_V0.3.0_Materials.png',full_page=True)
  page.locator('.tabs [data-action=project-tab][data-id=bom]').click()
  page.locator('[data-action=add-bom]').click()
  form=page.locator('form[data-form=bom]')
  form.locator('[name=partId]').select_option('part6')
  form.locator('[name=sectionId]').select_option('s4')
  form.locator('[name=required]').fill('500')
  form.locator('button[type=submit]').click()
  assert 'SW-CAB-024' in page.locator('.table').last.inner_text()
  page.locator('[data-action=project-tab][data-id=materials]').click()
  assert 'Avionics & software' in page.locator('.table').last.inner_text()
  assert not errors,errors
  print('PASS: V0.3 planner register/Gantt/baseline/validation/Excel CSV/material readiness/BOM linking')
  browser.close()
if __name__=='__main__':run()
