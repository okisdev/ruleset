import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.ts';

const origin = 'https://ruleset.harisfox.com';
const etag = '"asset-etag"';

function assets(entries = {}) {
  const calls = [];
  return {
    calls,
    async fetch(request) {
      calls.push(request);
      const { pathname } = new URL(request.url);
      if (!Object.hasOwn(entries, pathname)) return new Response(null, { status: 404 });
      const headers = { ETag: etag };
      if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers });
      return new Response(request.method === 'HEAD' ? null : entries[pathname], { headers });
    },
  };
}

for (const [path, mime] of [
  ['surge/social/chat.list', 'text/plain'],
  ['mihomo/social/chat.yaml', 'text/yaml'],
  ['catalog/services.json', 'application/json'],
  ['protected.json', 'application/json'],
  ['manifest.json', 'application/json'],
]) {
  test(`serves ${path} with GET and HEAD`, async () => {
    const route = `/latest/${path}`;
    const binding = assets({ [route]: 'artifact' });
    for (const method of ['GET', 'HEAD']) {
      const request = new Request(origin + route + '?download=1', { method });
      const response = await worker.fetch(request, { ASSETS: binding });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), `${mime}; charset=utf-8`);
      assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300');
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
      assert.equal(response.headers.get('ETag'), etag);
      assert.equal(await response.text(), method === 'GET' ? 'artifact' : '');
    }
    assert.deepEqual(binding.calls.map(({ method, url }) => [method, url]), [
      ['GET', origin + route + '?download=1'],
      ['HEAD', origin + route + '?download=1'],
    ]);
  });
}

test('preserves a conditional asset response and its cache headers', async () => {
  const binding = assets({ '/latest/manifest.json': '{}' });
  const request = new Request(origin + '/latest/manifest.json', { headers: { 'If-None-Match': etag } });
  const response = await worker.fetch(request, { ASSETS: binding });
  assert.equal(response.status, 304);
  assert.equal(response.body, null);
  assert.equal(response.headers.get('ETag'), etag);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('rejects invalid routes and traversal before fetching assets', async () => {
  const binding = assets();
  for (const path of [
    '/', '/latest', '/latest/', '/v/012345abcdef/manifest.json', '/manifest.json',
    '/latest//a.list', '/latest/a/../manifest.json', '/latest/./manifest.json',
    '/latest/%2e%2E/manifest.json', '/latest/a%2fb.list', '/latest/a%5cb.list',
    '/latest/%252e%252e/manifest.json', '/latest/bad%zz.list', '/latest/%00.list',
  ]) {
    const response = await worker.fetch({ url: origin + path, method: 'GET' }, { ASSETS: binding });
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    assert.equal(await response.text(), 'Not found');
  }
  assert.deepEqual(binding.calls, []);
});

test('returns a plain text 404 for missing assets', async () => {
  for (const method of ['GET', 'HEAD']) {
    const response = await worker.fetch(new Request(origin + '/latest/missing.json', { method }), { ASSETS: assets() });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    assert.equal(await response.text(), method === 'GET' ? 'Not found' : '');
  }
});

test('rejects other methods before fetching assets', async () => {
  const binding = assets();
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await worker.fetch(new Request(origin + '/latest/manifest.json', { method }), { ASSETS: binding });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  }
  assert.deepEqual(binding.calls, []);
});
