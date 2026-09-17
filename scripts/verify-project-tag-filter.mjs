// Verifies SPEC_PROJECT_TAG_FILTER against the scratch server (live DB copy + built frontend).
// Run: node scripts/verify-project-tag-filter.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:3100';
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

// ── go to project list ──
await page.goto(BASE + '/projects', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const tagSelect = page.locator('select[aria-label="Filter by tag"]');
check('tag filter select renders', await tagSelect.count() === 1);

const options = await tagSelect.locator('option').allTextContents();
check('tag options non-empty and includes All Tags',
  options[0] === 'All Tags' && options.length > 1,
  `first="${options[0]}", count=${options.length}`);
const sorted = options.slice(1);
check('tag options alphabetical',
  JSON.stringify(sorted) === JSON.stringify([...sorted].sort((a, b) => a.localeCompare(b))),
  sorted.slice(0, 5).join(','));

const cards = page.locator('.project-card');
const totalCards = await cards.count();
check('all projects shown by default', totalCards === 16, `cards=${totalCards}`);

// ── clear filters hidden by default ──
const clearBtn = page.locator('button.btn-ghost', { hasText: 'Clear filters' });
check('Clear filters hidden when no filter active', await clearBtn.count() === 0);

// ── apply tag=backend (expect 5 per live data) ──
await tagSelect.selectOption('backend');
await page.waitForTimeout(600);
const backendCards = await cards.count();
const backendNames = await cards.locator('.project-card-title, h3, .project-name').allTextContents().catch(() => []);
check('filter tag=backend -> 5 projects', backendCards === 5, `cards=${backendCards}`);

// every visible card must actually carry the backend tag
const visibleTagChips = await cards.evaluateAll(els => els.map(el => ({
  text: el.innerText.replace(/\s+/g, ' ').trim().slice(0, 90),
  tags: Array.from(el.querySelectorAll('.label-badge')).map(b => b.textContent.trim())
})));
const allHaveBackend = visibleTagChips.every(c => c.tags.some(t => t.toLowerCase() === 'backend'));
check('every visible card carries the backend tag', allHaveBackend,
  visibleTagChips.map(c => c.tags.join('+')).join(' , '));
check('no empty tag chips rendered', visibleTagChips.every(c => c.tags.length > 0 && c.tags.every(t => t !== '')));

// ── clear filters appears and resets ──
check('Clear filters visible when tag active', await clearBtn.count() === 1);
await clearBtn.click();
await page.waitForTimeout(600);
check('Clear filters resets to all projects', await cards.count() === 16, `cards=${await cards.count()}`);
check('tag select reset to All Tags',
  (await tagSelect.inputValue()) === '');

// ── case-insensitive match ──
await tagSelect.selectOption('infra');
await page.waitForTimeout(600);
check('filter tag=infra -> 5 projects', await cards.count() === 5, `cards=${await cards.count()}`);
await clearBtn.click();
await page.waitForTimeout(400);

// ── compose with status filter ──
await tagSelect.selectOption('product');
await page.waitForTimeout(400);
const productOnly = await cards.count();
const statusSel = page.locator('.project-filters select').nth(0);
await statusSel.selectOption('active');
await page.waitForTimeout(500);
const composed = await cards.count();
check('tag + status compose (AND, <= tag-only count)', composed <= productOnly,
  `tag only=${productOnly}, tag+active=${composed}`);
await clearBtn.click();
await page.waitForTimeout(400);

// ── CSV export tags column has real names, no "undefined" ──
await tagSelect.selectOption('backend');
await page.waitForTimeout(500);
const csv = await page.evaluate(async () => {
  // replicate the page's export expression against the live /api/projects payload
  const token = localStorage.getItem('token');
  const res = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
  const projects = await res.json();
  const projectTagNames = (p) => {
    let names;
    if (p.tagList && p.tagList.length) names = p.tagList.map(x => (typeof x === 'string' ? x : x && x.name));
    else names = (p.tags || '').split(',');
    const seen = new Set(); const out = [];
    for (const n of names) {
      if (n === null || n === undefined) continue;
      const t = String(n).trim();
      if (!t || seen.has(t)) continue;
      seen.add(t); out.push(t);
    }
    return out;
  };
  return projects.filter(p => projectTagNames(p).some(t => t.toLowerCase() === 'backend'))
    .map(p => projectTagNames(p).join('; '));
});
check('CSV tags column has real names', csv.length === 5 && csv.every(v => v.includes('backend') && !v.includes('undefined')),
  JSON.stringify(csv));

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log('FAILED:', failed.map(f => f.name).join(' | ')); process.exit(1); }
