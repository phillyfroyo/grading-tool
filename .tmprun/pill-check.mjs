import { chromium } from 'playwright';
const base = 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 460 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
// Login with a couple of retries (nodemon may briefly drop the socket on reload).
let loggedIn = false;
for (let attempt = 0; attempt < 5 && !loggedIn; attempt++) {
  try {
    const r = await ctx.request.post(base + '/auth/login', { data: { email: 'uitest@example.com' }, headers: { 'Content-Type': 'application/json' }, timeout: 8000 });
    loggedIn = r.ok();
    console.log('login attempt', attempt, '→', r.status());
  } catch (e) {
    console.log('login attempt', attempt, 'failed:', e.message.split('\n')[0]);
    await new Promise(res => setTimeout(res, 1500));
  }
}
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#gradingTabBar', { timeout: 10000 });
await page.waitForTimeout(800); // let tab-management init + renderTabBar run

function reveal(pct, cls) {
  return page.evaluate(({pct, cls}) => {
    const c = document.getElementById('autosaveCapacityChip');
    c.hidden = false;
    c.classList.remove('is-ok','is-warn','is-full'); c.classList.add(cls);
    document.getElementById('autosaveCapacityChipText').textContent =
      'Autosave ' + pct + '%' + (pct >= 90 ? ' — clear a tab' : '');
  }, {pct, cls});
}

async function geom(label) {
  const bar = await page.locator('#gradingTabBar').boundingBox();
  const pill = await page.locator('#autosaveCapacityChip').boundingBox();
  const list = await page.locator('#gradingTabList').boundingBox();
  const tabs = await page.locator('#gradingTabList .tab-item').count();
  const pillVisible = await page.locator('#autosaveCapacityChip').isVisible();
  const pillRight = pill ? Math.round(pill.x + pill.width) : null;
  const barRight = bar ? Math.round(bar.x + bar.width) : null;
  const listRight = list ? Math.round(list.x + list.width) : null;
  const pillLeft = pill ? Math.round(pill.x) : null;
  console.log(`[${label}] tabs=${tabs} pillVisible=${pillVisible} | barRight=${barRight} pillRight=${pillRight} (gap=${barRight-pillRight}) | listRight=${listRight} pillLeft=${pillLeft} (listStaysLeftOfPill=${listRight <= pillLeft + 2})`);
}

// 1 tab, ok band
await reveal(16, 'is-ok');
await page.waitForTimeout(250);
await geom('1 tab');
const box = await page.locator('.tab-container').boundingBox();
await page.screenshot({ path: '.tmprun/pill-1tab.png', clip: { x: box.x, y: box.y - 2, width: box.width, height: 70 } });

// Add up to 9 more tabs (cap is 10). Re-reveal warn band after.
for (let i = 0; i < 9; i++) {
  await page.evaluate(() => window.TabManagementModule && window.TabManagementModule.addTab());
  await page.waitForTimeout(80);
}
await reveal(82, 'is-warn');
await page.waitForTimeout(250);
await geom('10 tabs');
await page.screenshot({ path: '.tmprun/pill-10tabs.png', clip: { x: box.x, y: box.y - 2, width: box.width, height: 70 } });

// full band
await reveal(96, 'is-full');
await page.waitForTimeout(250);
await page.screenshot({ path: '.tmprun/pill-full.png', clip: { x: box.x, y: box.y - 2, width: box.width, height: 70 } });

console.log('errors:', errs.length ? errs : 'none');
await browser.close();
