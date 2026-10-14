// Local interactive preview with fixture data only. No request reaches Google Apps Script.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const browserTest = fs.readFileSync(path.join(__dirname, 'i18n.browser.cjs'), 'utf8');
const fixtureMatch = browserTest.match(/const fixture = `([\s\S]*?)`;\nconst server/);
if (!fixtureMatch) throw new Error('Unable to load the browser fixture.');
const fixture = fixtureMatch[1];
const port = Number(process.argv[2] || 8080);

const contentTypes = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon'
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/') {
    response.writeHead(302, { Location:'/reports.html' });
    response.end();
    return;
  }
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const allowed = relative.endsWith('.html') || relative.startsWith('assets/') || relative === 'RDF original s (2).png';
  const file = path.resolve(root, relative);
  if (!allowed || (file !== root && !file.startsWith(root + path.sep))) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  try {
    let content = fs.readFileSync(file);
    if (file.endsWith('.html')) {
      content = content.toString()
        .replace(/<script src="assets\/js\/tamper-guard\.js"><\/script>/g, '')
        .replace('<head>', '<head><script>' + fixture + '</script>');
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', contentTypes[path.extname(file).toLowerCase()] || 'application/octet-stream');
    response.end(content);
  } catch (_) {
    response.writeHead(404); response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`RDF local audit fixture: http://127.0.0.1:${port}/reports.html`);
  console.log(`Custom fields preview:  http://127.0.0.1:${port}/custom-fields.html`);
  console.log('Fixture data only; Google Apps Script requests are intercepted. Press Ctrl+C to stop.');
});
