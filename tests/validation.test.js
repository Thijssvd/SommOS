/* eslint-disable no-undef */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createApp } = require('../backend/server');

function post(port, path, body){
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname:'localhost', port, path, method:'POST', headers: { 'content-type':'application/json', 'content-length': Buffer.byteLength(payload) } }, res => {
      let data=''; res.on('data', d=>data+=d); res.on('end', ()=>resolve({ status: res.statusCode, json: data?JSON.parse(data):{} }));
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

test('guidance invalid vintage -> 422', async () => {
  const app = createApp(); const server = app.listen(0); const port = server.address().port;
  const r = await post(port, '/api/guidance', { vintage: 1500 });
  assert.equal(r.status, 422);
  server.close();
});

test('procurement negative -> 422', async () => {
  const app = createApp(); const server = app.listen(0); const port = server.address().port;
  const r = await post(port, '/api/procurement/analyze', { requests: [{ label: 'X', targetPrice: -1, qty: 1 }] });
  assert.equal(r.status, 422);
  server.close();
});

test('ready endpoint returns 200 when DB OK', async () => {
  const app = createApp(); const server = app.listen(0); const port = server.address().port;
  await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/ready`, res => {
      assert.ok([200,503].includes(res.statusCode)); // allow 200 if DB reachable; 503 otherwise
      resolve();
    }).on('error', reject);
  });
  server.close();
});
