import { webkit } from 'playwright';
const [, , url, out, w, h, fullPage] = process.argv;
const browser = await webkit.launch();
const page = await browser.newPage({
	viewport: { width: Number(w) || 393, height: Number(h) || 852 },
	deviceScaleFactor: 2
});
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: fullPage === 'full' });
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
