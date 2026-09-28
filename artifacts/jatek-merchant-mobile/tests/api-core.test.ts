// @ts-nocheck -- run with node:test via tsx (node types not in app tsconfig)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_BASE_URL, ApiError, buildApiUrl, frenchMessage, requestJson, parseWith, ordersSchema } from '../lib/api-core';

test('host is pinned', () => {
  assert.equal(API_BASE_URL, 'https://api.jatek.app');
  assert.equal(buildApiUrl('/api/backend/orders?limit=100'), 'https://api.jatek.app/api/backend/orders?limit=100');
});

test('rejects foreign hosts and non-api paths', () => {
  assert.throws(() => buildApiUrl('https://evil.example/api/x'));
  assert.throws(() => buildApiUrl('//evil.example/api/x'));
  assert.throws(() => buildApiUrl('http://localhost:5000/api/x'));
  assert.throws(() => buildApiUrl('/backend/me'));
  for (const bad of ['/api/../admin', '/api/%2e%2e/x', '/api/..%2fx/../../y', '\\\\evil.example/api/x', '/api\\..\\x',
    'https://user:pw@api.jatek.app/api/x', '/api/x#frag', 'https://api.jatek.app.evil.example/api/x', 'http://api.jatek.app/api/x', '']) {
    assert.throws(() => buildApiUrl(bad), undefined, bad);
  }
  assert.equal(buildApiUrl('https://api.jatek.app/api/backend/me'), 'https://api.jatek.app/api/backend/me');
});

test('sends bearer + json body to fixed host', async () => {
  let seen: { url: string; init?: RequestInit } | null = null;
  const f = async (url: string, init?: RequestInit) => { seen = { url, init }; return new Response('{"ok":1}', { status: 200 }); };
  const r = await requestJson(f, '/api/backend/login', { method: 'POST', body: { email: 'a' }, token: 'T' });
  assert.deepEqual(r, { ok: 1 });
  assert.equal(seen!.url, 'https://api.jatek.app/api/backend/login');
  const h = seen!.init!.headers as Record<string, string>;
  assert.equal(h.Authorization, 'Bearer T');
  assert.equal(seen!.init!.body, '{"email":"a"}');
  assert.equal(seen!.init!.redirect, 'error');
});

test('supports authenticated PATCH status updates', async () => {
  let seen: { url: string; init?: RequestInit } | null = null;
  const f = async (url: string, init?: RequestInit) => { seen = { url, init }; return new Response('{"id":7}', { status: 200 }); };
  await requestJson(f, '/api/orders/7/status', { method: 'PATCH', body: { status: 'accepted' }, token: 'T' });
  assert.equal(seen!.url, 'https://api.jatek.app/api/orders/7/status');
  assert.equal(seen!.init!.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(seen!.init!.body)), { status: 'accepted' });
  assert.equal((seen!.init!.headers as Record<string, string>).Authorization, 'Bearer T');
});

test('explains the merchant profile acceptance requirement in French', () => {
  assert.equal(
    frenchMessage(412, 'Complete your business profile (legal name + ICE) before accepting orders.'),
    'Complétez le profil légal de votre boutique avant d’accepter une commande.',
  );
});

test('maps http errors, network errors, bad json', async () => {
  await assert.rejects(requestJson(async () => new Response('{"error":"Invalid credentials"}', { status: 401 }), '/api/backend/me'),
    (e: unknown) => e instanceof ApiError && e.status === 401);
  await assert.rejects(requestJson(async () => { throw new TypeError('net'); }, '/api/backend/me'),
    (e: unknown) => e instanceof ApiError && e.status === 0);
  await assert.rejects(requestJson(async () => new Response('<html>', { status: 200 }), '/api/backend/me'),
    (e: unknown) => e instanceof ApiError);
});

test('schema validation surfaces failures', () => {
  assert.throws(() => parseWith(ordersSchema, [{ id: 'x' }], 'commandes'), ApiError);
  const ok = parseWith(ordersSchema, [{ id: 1, status: 'pending', total: 12.5 }], 'commandes');
  assert.equal(ok[0].total, 12.5);
});
