// Approval-видео нового connect-движения (без текста): PNG -> mp4 30fps.
//   node render_approval.js
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const ROOT = __dirname;
const W = 1280, H = 800, FPS = 30;
const MIME = {'.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json'};

function serve(port) {
    return new Promise(res => {
        const srv = http.createServer((req, res) => {
            const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index_connect.html';
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
    const outDir = process.env.APPROVAL_FRAMES ||
        path.join(ROOT, '..', 'assets', 'preview_frames');
    fs.rmSync(outDir, {recursive: true, force: true});
    fs.mkdirSync(outDir, {recursive: true});
    const srv = await serve(8914);
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader']});
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 300)));
    await page.setViewport({width: W, height: H});
    await page.goto('http://127.0.0.1:8914/index_connect.html');
    await page.waitForFunction('window.__ready===true', {timeout: 60000});
    await page.evaluate(() => window.setTransparent(true));
    await page.addStyleTag({content: '.title, .close, .stats { display: none !important; }'});
    await new Promise(r => setTimeout(r, 400));
    const DUR = await page.evaluate(() => window.__dur);
    const N = Math.round(FPS * DUR);
    console.log(`[approval] ${N} frames`);
    for (let i = 0; i <= N; i++) {
        const t = (i / N) * DUR;
        await page.evaluate(tt => window.renderAt(tt), t);
        await new Promise(r => setTimeout(r, 25));
        await page.screenshot({path: path.join(outDir, `f_${String(i).padStart(4, '0')}.png`), omitBackground: true});
        if (i % 40 === 0) process.stdout.write(`  ${i}/${N}\n`);
    }
    await browser.close(); srv.close();
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS),
        '-i', path.join(outDir, 'f_%04d.png'), '-c:v', 'mpeg4', '-q:v', '3', '-pix_fmt', 'yuv420p',
        path.join(ROOT, '..', 'assets', 'airpods_connect_new.mp4')], {stdio: 'inherit'});
    console.log('[approval] video done');
})().catch(e => { console.error(e); process.exit(1); });
