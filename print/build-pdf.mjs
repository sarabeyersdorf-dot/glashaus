// Prints print/house-rules.html to print/house-rules.pdf (US Letter, one page) with the site's fonts
// embedded. Needs playwright and @fontsource/{quicksand,montserrat} installed where it runs:
//   node print/build-pdf.mjs <dir containing node_modules>
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const mods = path.resolve(process.argv[2] || '.'); const req = createRequire(path.join(mods, 'x.js'));
const { chromium } = req('playwright');
const here = path.dirname(new URL(import.meta.url).pathname);
const font = (pkg, file, family, weight) => `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(mods, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')}) format("woff2")}`;
const faces = [font('quicksand', 'quicksand-latin-600-normal.woff2', 'Quicksand', 600),
  ...[500, 600, 800].map(w => font('montserrat', `montserrat-latin-${w}-normal.woff2`, 'Montserrat', w))].join('');
const html = fs.readFileSync(path.join(here, 'house-rules.html'), 'utf8').replace('<style>', `<style>${faces}`);
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent(html, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
const over = await p.evaluate(() => { const g = document.querySelector('.page'); return g.scrollHeight - g.clientHeight; });
await p.pdf({ path: path.join(here, 'house-rules.pdf'), width: '8.5in', height: '11in', printBackground: true, pageRanges: '1' });
await p.setViewportSize({ width: 816, height: 1056 }); await p.screenshot({ path: process.argv[3] || path.join(here, 'house-rules.png') });
console.log('overflow px:', over); await b.close();
