'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { homeForRole, findRoute, safeNext, normalizePath } = require('../../src/auth/routes.config');
const { acceptAuthEvent } = require('../../src/auth/syncRules');

test('home path follows the role', () => {
  assert.equal(homeForRole('admin'), '/admin');
  assert.equal(homeForRole('teacher'), '/teacher');
  assert.equal(homeForRole('parent'), '/parent');
  assert.equal(homeForRole('student'), '/login');
});

test('portal routes allow only their role', () => {
  assert.deepEqual(findRoute('/admin').roles, ['admin']);
  assert.equal(findRoute('/teacher').public, false);
  assert.equal(findRoute('/login').public, true);
  assert.equal(findRoute('/nope'), null);
  assert.equal(normalizePath('/admin/'), '/admin');
});

test('next is kept only when that role may open it', () => {
  assert.equal(safeNext('/admin', 'admin'), '/admin');
  assert.equal(safeNext('/admin', 'teacher'), null);
  assert.equal(safeNext('/login', 'admin'), null);
  assert.equal(safeNext('//evil.example', 'admin'), null);
  assert.equal(safeNext('https://evil.example', 'admin'), null);
});

test('auth events from this tab are ignored', () => {
  assert.equal(acceptAuthEvent({ type: 'LOGOUT', tabId: 'a' }, 'a'), null);
  assert.equal(acceptAuthEvent({ type: 'LOGOUT', tabId: 'b' }, 'a'), 'LOGOUT');
  assert.equal(acceptAuthEvent({ type: 'LOGIN', tabId: 'b' }, 'a'), 'LOGIN');
  assert.equal(acceptAuthEvent({ type: 'OTHER', tabId: 'b' }, 'a'), null);
  assert.equal(acceptAuthEvent(null, 'a'), null);
});
