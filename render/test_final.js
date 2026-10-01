// Один тестовый кадр сцены в момент T (для калибровки компоновки).
//   T=7 OUT=/tmp/opencode/test_final.png node test_final.js
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json'};

function serve(port) {
    return new Promise(res => {
        const srv = http.createServer((req, res) => {
            const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
            const p = path.join(ROOT, rel);
            fs.readFile(p, (e, d) => {
                if (e) { res.writeHead(404); res.end('nf'); return; }
                res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
                res.end(d);
            });
        });
        srv.listen(port, () => res(srv));
    });
}

(async () => {
    const T = parseFloat(process.env.T || '7');
    const OUT = process.env.OUT || '/tmp/opencode/test_final.png';
    const port = 8922;
    const srv = await serve(port);
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader']});
    const page = await browser.newPage();
    await page.setViewport({width: 1280, height: 800});
    const PAGE = process.env.PAGE || 'index.html';
    await page.goto(`http://127.0.0.1:${port}/${PAGE}`);
    await page.waitForFunction('window.__ready===true', {timeout: 60000});
    await page.evaluate(() => window.setTransparent(true));
    await page.addStyleTag({content: '.title, .close, .stats { display: none !important; }'});
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(t => window.renderAt(t), T);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({path: OUT, omitBackground: true});
    await browser.close(); srv.close();
    console.log('shot', T, '->', OUT);
})().catch(e => { console.error(e); process.exit(1); });
