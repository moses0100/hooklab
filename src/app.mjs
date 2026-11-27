import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { openStore } from './store.mjs';
import { RequestError, paramsObject, parseBody, readBody, redact } from './payload.mjs';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);

export function createApp({ database = ':memory:', retention = 200 } = {}) {
  const store = openStore(database, retention);
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    function json(status, value) {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(value));
    }
    try {
      const port = server.address().port;
      const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      if (!allowedHosts.has(request.headers.host)) throw new RequestError(403, 'เปิดผ่าน localhost ของเครื่องนี้เท่านั้น');
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
        throw new RequestError(403, 'ไม่รับคำขอจากหน้าเว็บอื่น');
      }
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname === '/api/info' && request.method === 'GET') {
        return json(200, { captureUrl: `http://${request.headers.host}/hooks/${store.inbox}`, retention, maxBodyBytes: 262144 });
      }
      if (url.pathname === '/api/requests' && request.method === 'GET') return json(200, { requests: store.list() });
      const detail = url.pathname.match(/^\/api\/requests\/([1-9]\d*)$/);
      if (detail && request.method === 'GET') {
        const id = Number(detail[1]);
        const row = Number.isSafeInteger(id) ? store.get(id) : null;
        return row ? json(200, row) : json(404, { error: 'ไม่พบรายการนี้ อาจถูกลบจากประวัติเก่าสุดแล้ว' });
      }
      if (detail && request.method === 'DELETE') {
        const id = Number(detail[1]);
        const deleted = Number.isSafeInteger(id) ? store.remove(id) : false;
        return deleted ? json(200, { deleted: true, id }) : json(404, { error: 'ไม่พบรายการนี้ อาจถูกลบไปแล้วหรือหลุดจากประวัติเก่าสุด' });
      }
      const exportRequest = url.pathname.match(/^\/api\/requests\/([1-9]\d*)\/export$/);
      if (exportRequest && request.method === 'GET') {
        const id = Number(exportRequest[1]);
        const row = Number.isSafeInteger(id) ? store.get(id) : null;
        if (!row) return json(404, { error: 'ไม่พบรายการนี้ อาจถูกลบจากประวัติเก่าสุดแล้ว' });
        const timestamp = new Date(row.receivedAt).toISOString().replace(/[:.]/g, '-');
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="hooklab-request-${id}-${timestamp}.json"`
        });
        response.end(JSON.stringify(row, null, 2));
        return;
      }
      if (url.pathname === `/hooks/${store.inbox}`) {
        const buffer = await readBody(request);
        const parsed = parseBody(buffer, request.headers['content-type']);
        const id = store.save({ method: request.method, receivedAt: new Date().toISOString(), bytes: buffer.length,
          kind: parsed.kind, headers: redact(request.headers), query: redact(paramsObject(url.searchParams)), body: parsed.value });
        return json(200, { received: true, id });
      }
      if (request.method === 'GET' && assets.has(url.pathname)) {
        const [filename, type] = assets.get(url.pathname);
        const content = await readFile(new URL(`../public/${filename}`, import.meta.url));
        response.writeHead(200, { 'Content-Type': type }); response.end(content); return;
      }
      json(404, { error: 'ไม่พบ endpoint นี้' });
    } catch (error) {
      json(error instanceof RequestError ? error.status : 500,
        { error: error instanceof RequestError ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('close', () => store.close());
  return server;
}

