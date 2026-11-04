import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.mjs';
import { request } from 'node:http';
import { redact, MASK } from '../src/payload.mjs';

async function app(t, options = {}) {
  const server = createApp(options); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
  t.after(close);
  const base = `http://127.0.0.1:${server.address().port}`;
  const info = await fetch(`${base}/api/info`).then(r => r.json());
  return { server, base, close, ...info };
}

test('nested JSON, header and query secrets are masked before persistence', async t => {
  const { base, captureUrl } = await app(t);
  const response = await fetch(`${captureUrl}?token=not-for-disk&tag=a&tag=b`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-for-disk', 'X-Api-Key': 'not-for-disk' },
    body: JSON.stringify({ order: 42, customer: { password: 'not-for-disk' }, items: [{ secret: 'not-for-disk', name: 'book' }] }) });
  assert.equal(response.status, 200);
  const { id } = await response.json();
  const stored = await fetch(`${base}/api/requests/${id}`).then(r => r.json());
  assert.equal(stored.body.order, 42); assert.equal(stored.body.customer.password, MASK);
  assert.equal(stored.body.items[0].secret, MASK); assert.equal(stored.headers.authorization, MASK);
  assert.equal(stored.headers['x-api-key'], MASK); assert.deepEqual(stored.query.tag, ['a', 'b']);
  assert.equal(JSON.stringify(stored).includes('not-for-disk'), false);
});

test('form submissions retain repeated fields and redact secrets', async t => {
  const { base, captureUrl } = await app(t);
  const response = await fetch(captureUrl, { method: 'POST', body: new URLSearchParams('tag=a&tag=b&password=private') });
  const { id } = await response.json();
  const stored = await fetch(`${base}/api/requests/${id}`).then(r => r.json());
  assert.deepEqual(stored.body, { tag: ['a', 'b'], password: MASK }); assert.equal(stored.kind, 'form');
});

test('invalid JSON, unsupported bodies and oversized requests do not enter history', async t => {
  const { base, captureUrl } = await app(t);
  for (const [body, type, expected] of [['{','application/json',400],['hello','text/plain',415],['x'.repeat(262145),'application/json',413]]) {
    const response = await fetch(captureUrl, { method: 'POST', headers: { 'Content-Type': type }, body });
    assert.equal(response.status, expected); await response.text();
  }
  assert.deepEqual(await fetch(`${base}/api/requests`).then(r=>r.json()), { requests: [] });
});

test('retention removes oldest records and endpoints reject invalid identities', async t => {
  const { base, captureUrl } = await app(t, { retention: 2 });
  for (let i=0;i<3;i++) await fetch(captureUrl).then(r=>r.text());
  const { requests } = await fetch(`${base}/api/requests`).then(r=>r.json());
  assert.deepEqual(requests.map(r=>r.id), [3,2]);
  assert.equal((await fetch(`${base}/api/requests/1`)).status, 404);
  assert.equal((await fetch(`${base}/api/requests/99999999999999999999`)).status, 404);
  assert.equal((await fetch(`${base}/hooks/not-the-inbox`)).status, 404);
});

test('cross-origin browser requests are rejected; secret-bearing input is not mutated', async t => {
  const { base, captureUrl } = await app(t);
  assert.equal((await fetch(captureUrl, { headers: { Origin: 'https://example.org' } })).status, 403);
  const status = await new Promise((resolve,reject)=>{
    const req=request(`${base}/api/info`,{headers:{Host:'untrusted.example'}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);req.end();
  });
  assert.equal(status, 403);
  const input = { nested: { access_token: 'private', safe: 12 } };
  assert.deepEqual(redact(input), { nested: { access_token: MASK, safe: 12 } });
  assert.equal(input.nested.access_token, 'private');
});

test('SQLite preserves inbox identity and redacted requests across restart', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'hooklab-test-'));
  t.after(()=>rm(folder, { recursive:true, force:true }));
  const database=join(folder,'inbox.sqlite');
  const first=await app(t,{database});
  await fetch(first.captureUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"api_key":"secret-sentinel","event":"test"}'});
  await first.close();
  const second=await app(t,{database});
  assert.equal(new URL(first.captureUrl).pathname,new URL(second.captureUrl).pathname);
  const {requests}=await fetch(`${second.base}/api/requests`).then(r=>r.json());
  assert.equal(requests.length,1);
  for (const filename of await readdir(folder)) {
    const disk=await readFile(join(folder,filename));
    assert.equal(disk.includes(Buffer.from('secret-sentinel')),false,filename);
  }
  await second.close();
});

test('UI assets load locally and private database files are not served', async t => {
  const {base}=await app(t);
  const page=await fetch(base);
  assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
  assert.match(await page.text(),/HookLab/);
  for(const path of ['/app.js','/styles.css','/favicon.svg'])assert.equal((await fetch(base+path)).status,200,path);
  for(const path of ['/.data/hooklab.sqlite','/src/store.mjs','/package.json'])assert.equal((await fetch(base+path)).status,404,path);
});

test('overly nested JSON is rejected without retaining a partial request', async t => {
  const {base,captureUrl}=await app(t);
  let nested={ok:true};for(let i=0;i<45;i++)nested={nested};
  const response=await fetch(captureUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(nested)});
  assert.equal(response.status,400);
  assert.deepEqual((await fetch(`${base}/api/requests`).then(r=>r.json())).requests,[]);
});
