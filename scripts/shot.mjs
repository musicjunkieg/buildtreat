import { chromium } from 'playwright';

const [, , url, out, w, h, fullPage] = process.argv;
const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({
	viewport: { width: Number(w) || 393, height: Number(h) || 852 },
	deviceScaleFactor: 2,
	reducedMotion: 'no-preference'
});
const errors = [];
page.on('console', (m) => {
	if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: fullPage === 'full' });
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'));
else console.log('no console errors');
await browser.close();
