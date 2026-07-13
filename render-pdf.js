import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outputPath = resolve(process.argv[2] || 'output/template1-invoice.pdf');
const require = createRequire(import.meta.url);
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg' };

async function getChromium() {
  try { return require('playwright').chromium; }
  catch { throw new Error('Playwright is required. Run: npm install'); }
}

const server = createServer(async (request, response) => {
  try {
    const requestPath = request.url === '/' ? '/invoice-template.html' : request.url.split('?')[0];
    const safePath = normalize(requestPath).replace(/^([/\\])+/, '');
    const filePath = join(root, safePath);
    if (!filePath.startsWith(root)) throw new Error('Invalid path');
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(await readFile(filePath));
  } catch { response.writeHead(404); response.end('Not found'); }
});

server.listen(0, '127.0.0.1', async () => {
  try {
    const { port } = server.address();
    await mkdir(resolve(outputPath, '..'), { recursive: true });
    const browser = await getChromium().launch();
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}/invoice-template.html`, { waitUntil: 'networkidle' });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    await browser.close();
    console.log(`Created ${outputPath}`);
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); }
});
