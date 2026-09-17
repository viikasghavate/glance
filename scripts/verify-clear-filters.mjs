// Verifies SPEC_PROJECT_VIEW_CLEAR_FILTERS against the test server (live DB copy).
// Run: node scripts/verify-clear-filters.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3100';
const EMAIL = 'admin@glance.local';
const PASS = 'admin123';
const PROJECT_ID = 3;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

// ── login ──
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 15000 });
check('login works', true);

await page.goto(`${BASE}/project/${PROJECT_ID}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const clearBtn = () => page.locator('button.toolbar-clear', { hasText: 'Clear filters' });
const TOOLBAR = { board: '.kanban-filters', list: '.task-filters', timeline: '.timeline-filters' };

for (const view of ['board', 'list', 'timeline']) {
  const label = view[0].toUpperCase() + view.slice(1);

  // switch view via the sidebar view switcher
  const viewBtn = page.locator(`button:has-text("${label}")`).filter({ hasNotText: /Clear|Export|New/ }).last();
  await viewBtn.click();
  await page.waitForTimeout(900);

  const toolbar = page.locator(TOOLBAR[view]).first();
  await toolbar.waitFor({ timeout: 8000 });
  // priority select = the one containing an option with value "high"
  const sel = toolbar.locator('select').filter({ has: page.locator('option[value="high"]') }).first();

  // 1. hidden at defaults
  const beforeCount = await clearBtn().count();
  check(`${label}: button hidden at defaults`, beforeCount === 0, `count=${beforeCount}`);

  // 2. appears after changing a filter
  await sel.selectOption('high');
  await page.waitForTimeout(500);
  const afterCount = await clearBtn().count();
  check(`${label}: button appears after filter change`, afterCount === 1, `count=${afterCount}`);

  // 3. clicking resets everything
  if (afterCount === 1) {
    await clearBtn().first().click();
    await page.waitForTimeout(700);
    const selVal = await sel.inputValue();
    const btnGone = await clearBtn().count();
    const allSelects = await toolbar.locator('select').evaluateAll(nodes => nodes.map(n => n.value));
    check(`${label}: priority select reset`, selVal === '', `value="${selVal}"`);
    check(`${label}: button disappears after reset`, btnGone === 0, `count=${btnGone}`);
    check(`${label}: all selects at defaults`, allSelects.every(v => v === ''), JSON.stringify(allSelects));
  }

  // 4. search reset
  const searchBox = toolbar.locator('input[type="text"]').first();
  await searchBox.fill('zzz');
  await page.waitForTimeout(500);
  const searchBtn = await clearBtn().count();
  check(`${label}: button appears after search`, searchBtn === 1, `count=${searchBtn}`);
  if (searchBtn === 1) {
    await clearBtn().first().click();
    await page.waitForTimeout(700);
    const sbVal = await searchBox.inputValue();
    check(`${label}: search cleared`, sbVal === '', `value="${sbVal}"`);
  }

  // 5. sort reset (List/Board/Timeline all have a Sort by select)
  const sortSel = toolbar.locator('select').filter({ has: page.locator('option[value="priority"]') }).nth(1);
  if (await sortSel.count()) {
    await sortSel.selectOption('priority').catch(() => {});
    await page.waitForTimeout(400);
    const sortBtnCount = await clearBtn().count();
    if (sortBtnCount === 1) {
      await clearBtn().first().click();
      await page.waitForTimeout(600);
      check(`${label}: sort reset`, (await sortSel.inputValue()) === '', `value="${await sortSel.inputValue()}"`);
    } else {
      check(`${label}: sort change shows button`, false, 'button did not appear');
    }
  }
}

// 6. MyTasks unaffected
await page.goto(BASE + '/my-tasks', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const bodyText = await page.locator('body').innerText();
check('MyTasks page still renders', /my tasks/i.test(bodyText), bodyText.slice(0, 60).replace(/\n/g, ' '));

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILURES:', JSON.stringify(failed, null, 2)); process.exit(1); }
