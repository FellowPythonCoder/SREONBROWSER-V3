'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startBoot } = require('../src/boot');

function fixture(overrides = {}) {
  const main = new EventEmitter();
  main.webContents = new EventEmitter();
  main.shown = 0;
  main.show = () => { main.shown++; };
  main.focus = () => {};
  main.isDestroyed = () => false;
  const splash = { closed: 0, isDestroyed: () => splash.closed > 0, close: () => { splash.closed++; } };
  const failures = [];
  startBoot({ mainWindow: main, splashWindow: splash, load: () => {},
    onFailure: message => failures.push(message), logger: { info() {}, error() {} },
    timeoutMs: 30, ...overrides });
  return { main, splash, failures };
}

test('first paint reveals main and closes splash exactly once', () => {
  const { main, splash } = fixture();
  main.emit('ready-to-show');
  main.webContents.emit('did-finish-load');
  assert.equal(main.shown, 1);
  assert.equal(splash.closed, 1);
});

test('completed load closes splash even if ready-to-show never fires', () => {
  const { main, splash } = fixture();
  main.webContents.emit('did-finish-load');
  assert.equal(main.shown, 1);
  assert.equal(splash.closed, 1);
});

test('failed main-frame load closes splash and reports error', () => {
  const { main, splash, failures } = fixture();
  main.webContents.emit('did-fail-load', {}, -6, 'FILE_NOT_FOUND', 'file:///index.html', false);
  assert.equal(splash.closed, 0);
  main.webContents.emit('did-fail-load', {}, -6, 'FILE_NOT_FOUND', 'file:///index.html', true);
  assert.equal(splash.closed, 1);
  assert.equal(main.shown, 1);
  assert.match(failures[0], /FILE_NOT_FOUND/);
});

test('timeout releases splash when no readiness event arrives', async () => {
  const { main, splash, failures } = fixture({ timeoutMs: 5 });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(splash.closed, 1);
  assert.equal(main.shown, 1);
  assert.match(failures[0], /timed out/);
});

test('rejected load releases splash', async () => {
  const { main, splash, failures } = fixture({ load: () => Promise.reject(new Error('bad file')) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(main.shown, 1);
  assert.equal(splash.closed, 1);
  assert.equal(failures[0], 'bad file');
});

test('closing main during startup closes splash', () => {
  const { main, splash } = fixture();
  main.emit('closed');
  assert.equal(splash.closed, 1);
  assert.equal(main.shown, 0);
});

test('a synchronous load error still releases the splash', () => {
  const { main, splash, failures } = fixture({ load: () => { throw new Error('missing UI'); } });
  assert.equal(main.shown, 1);
  assert.equal(splash.closed, 1);
  assert.equal(failures[0], 'missing UI');
});

test('a failure-page error does not strand the splash', () => {
  const { main, splash } = fixture({
    load: () => { throw new Error('missing UI'); },
    onFailure: () => { throw new Error('missing fallback'); }
  });
  assert.equal(main.shown, 1);
  assert.equal(splash.closed, 1);
});
