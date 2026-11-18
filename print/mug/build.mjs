// node print/mug/build.mjs <dir with node_modules: playwright, @fontsource/{instrument-serif,archivo}>
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const mods = path.resolve(process.argv[2] || '.'); const req = createRequire(path.join(mods, 'x.js'));
const { chromium } = req('playwright');
const here = path.dirname(new URL(import.meta.url).pathname); const rd = f => fs.readFileSync(path.join(here, f));
const font = (pkg, file, family, w) => `@font-face{font-family:"${family}";font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(mods, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64')}) format("woff2")}`;
const faces = [font('instrument-serif', 'instrument-serif-latin-400-normal.woff2', 'Instrument Serif', 400),
  ...[400, 700].map(w => font('archivo', `archivo-latin-${w}-normal.woff2`, 'Archivo', w))].join('');
const svg = f => rd(f).toString().replace(/^<\?xml[^>]*>/, '').replace(/<path /g, '<path fill="#102A3A" ').replace(/ width="[^"]*" height="[^"]*"/, '');
const html = rd('mug-card.html').toString().replace('<style>', `<style>${faces}`)
  .replace('url(dome-art.jpg)', `url(data:image/jpeg;base64,${rd('dome-art.jpg').toString('base64')})`)
  .replace('{{venmo}}', svg('venmo.svg')).replace('{{paypal}}', svg('paypal.svg'));
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 384, height: 576 }, deviceScaleFactor: 3.125 });
await p.setContent(html, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
const over = await p.evaluate(() => { const c = document.querySelector('.card'); return [...c.children].reduce((a, e) => a + e.getBoundingClientRect().height, 0) - c.clientHeight; });
await p.pdf({ path: path.join(here, 'mug-card.pdf'), width: '4in', height: '6in', printBackground: true });
await p.screenshot({ path: path.join(here, 'mug-card.jpg'), type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 384, height: 576 } });
console.log('content minus card height (px, must be <= 0):', Math.round(over)); await b.close();
