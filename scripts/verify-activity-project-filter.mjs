// Verifies SPEC_ACTIVITY_LOG_PROJECT_FILTER against the scratch server
// (live DB copy + built frontend). Run: node scripts/verify-activity-project-filter.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3121';
const EMAIL = 'admin@glance.local';
const PASS = 'admin123';

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
await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
check('login works', true);

await page.goto(BASE + '/activity', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const selects = page.locator('.activity-filters select');
const selectCount = await selects.count();
check('activity filters render', selectCount >= 3, `selects=${selectCount}`);

// the project select is the one whose first option is All Projects
let projSelect = null;
for (let i = 0; i < selectCount; i++) {
  const first = (await selects.nth(i).locator('option').first().textContent()) || '';
  if (first.trim() === 'All Projects') projSelect = selects.nth(i);
}
check('project filter select renders', !!projSelect);

const opts = await projSelect.locator('option').allTextContents();
check('project options include All Projects + real projects',
  opts[0] === 'All Projects' && opts.length > 1,
  `count=${opts.length}, first5=${opts.slice(0, 5).join(' | ')}`);
const sorted = opts.slice(1);
check('project options carry project names', sorted.includes('Website Redesign') || sorted.includes('Mobile App Launch'),
  sorted.slice(0, 3).join(', '));

const rowsAll = await page.locator('.activity-row').count();
check('unfiltered list renders rows', rowsAll > 0, `rows=${rowsAll}`);

// ── filter to a project that actually has logged activity ──
// (live data: only "ServiceNow upgrade to Australia version" carries task activity)
const target = 'ServiceNow upgrade to Australia version';
const targetValue = await projSelect.locator('option', { hasText: target }).getAttribute('value');
check('target project with activity exists in dropdown', !!targetValue, `value=${targetValue}`);
await projSelect.selectOption(targetValue);
await page.waitForTimeout(1200);
const rowsScoped = await page.locator('.activity-row').count();
check('scoping to a project returns a smaller set', rowsScoped > 0 && rowsScoped < rowsAll,
  `scoped=${rowsScoped} vs all=${rowsAll}`);
const badges = await page.locator('.activity-badge').allTextContents();
check('every scoped row is task activity', badges.length > 0 && badges.every(b => b.trim() === 'task'),
  [...new Set(badges.map(b => b.trim()))].join(','));
check('no error surfaced', (await page.locator('.error-msg').count()) === 0);

// ── clearing restores ──
await projSelect.selectOption('');
await page.waitForTimeout(1200);
const rowsRestored = await page.locator('.activity-row').count();
check('clearing the project filter restores the full list', rowsRestored === rowsAll,
  `restored=${rowsRestored} vs all=${rowsAll}`);

// ── compose with entity type ──
await projSelect.selectOption(targetValue);
await page.waitForTimeout(800);
let entitySelect = null;
for (let i = 0; i < selectCount; i++) {
  const vals = await selects.nth(i).locator('option').evaluateAll(os => os.map(o => o.value));
  if (vals.includes('task') && vals.includes('comment')) entitySelect = selects.nth(i);
}
if (entitySelect) {
  await entitySelect.selectOption('comment');
  await page.waitForTimeout(1000);
  const composed = await page.locator('.activity-row').count();
  check('project + entity_type compose (comment => 0 rows)', composed === 0, `rows=${composed}`);
  await entitySelect.selectOption('');
  await page.waitForTimeout(800);
} else {
  check('entity type select found for compose test', false, 'not found');
}

// ── project + actor compose (no regression) ──
let userSelect = null;
for (let i = 0; i < selectCount; i++) {
  const first = ((await selects.nth(i).locator('option').first().textContent()) || '').trim();
  if (first === 'All Users') userSelect = selects.nth(i);
}
const userOpts = userSelect ? await userSelect.locator('option').allTextContents() : [];
if (userSelect && userOpts.length > 1) {
  await userSelect.selectOption({ index: 1 });
  await page.waitForTimeout(1000);
  check('project + actor compose without error', (await page.locator('.error-msg').count()) === 0,
    `rows=${await page.locator('.activity-row').count()}`);
  await userSelect.selectOption('');
  await page.waitForTimeout(800);
}

// ── CSV export forwards project_id ──
const reqs = [];
page.on('request', r => { if (r.url().includes('/api/activity/export')) reqs.push(r.url()); });
await projSelect.selectOption(targetValue);
await page.waitForTimeout(800);
const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await page.locator('button.btn-ghost', { hasText: 'Export CSV' }).click();
const download = await dl;
check('CSV export triggered', !!download, download ? download.suggestedFilename() : 'no download');
const exportUrl = reqs[reqs.length - 1] || '';
check('CSV export URL carries project_id', exportUrl.includes('project_id=' + targetValue), exportUrl.slice(-90));

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILURES:'); failed.forEach(f => console.log(' -', f.name, f.detail)); process.exit(1); }
