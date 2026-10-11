'use strict';

const $ = id => document.getElementById(id);
const tabs = new Map();
let nextId = 0;
let activeId;
const home = $('home-page');
const views = $('views');
const address = $('address');

function toDestination(input) {
  const text = input.trim();
  if (!text) return null;
  // Never navigate to script:, file:, data:, or custom protocols.
  if (/^https?:\/\//i.test(text)) {
    try { return ['http:', 'https:'].includes(new URL(text).protocol) ? text : null; }
    catch { return null; }
  }
  if (/^(localhost|(?:[a-z\d-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:[/?#]|$)/i.test(text) && !/\s/.test(text)) {
    return `${/^(localhost|\d+\.)/i.test(text) ? 'http' : 'https'}://${text}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}

function current() { return tabs.get(activeId); }
function updateNavigation() {
  const tab = current();
  if (!tab) return;
  $('back').disabled = tab.isHome || !tab.view || !tab.view.canGoBack();
  $('forward').disabled = tab.isHome || !tab.view || !tab.view.canGoForward();
  $('loading-indicator').classList.toggle('visible', tab.loading && !tab.isHome);
  if (document.activeElement !== address) address.value = tab.isHome ? '' : tab.url;
  $('address-symbol').textContent = tab.isHome ? '✦' : (tab.url.startsWith('https:') ? '♢' : '○');
  document.title = tab.isHome ? 'New tab · SREON Browser' : `${tab.title} · SREON Browser`;
}
function activate(id) {
  if (!tabs.has(id)) return;
  activeId = id;
  for (const tab of tabs.values()) {
    tab.button.classList.toggle('active', tab.id === id);
    tab.button.setAttribute('aria-selected', String(tab.id === id));
    if (tab.view) tab.view.classList.toggle('active', tab.id === id && !tab.isHome);
  }
  home.classList.toggle('hidden', !current().isHome);
  updateNavigation();
}
function createTab() {
  const id = ++nextId;
  const button = document.createElement('div');
  button.className = 'tab';
  button.setAttribute('role', 'tab');
  button.tabIndex = 0;
  const dot = document.createElement('span'); dot.className = 'tab-dot';
  const title = document.createElement('span'); title.className = 'tab-title'; title.textContent = 'New tab';
  const close = document.createElement('button'); close.className = 'tab-close'; close.title = 'Close tab'; close.setAttribute('aria-label', 'Close tab'); close.textContent = '×';
  button.append(dot, title, close);
  button.addEventListener('click', () => activate(id));
  button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') activate(id); });
  close.addEventListener('click', event => { event.stopPropagation(); closeTab(id); });
  $('tabs').append(button);
  tabs.set(id, { id, button, titleNode: title, view: null, title: 'New tab', url: '', isHome: true, loading: false });
  activate(id);
  return tabs.get(id);
}
function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  const ids = Array.from(tabs.keys());
  const neighbor = ids[ids.indexOf(id) + 1] || ids[ids.indexOf(id) - 1];
  tab.view?.remove();
  tab.button.remove();
  tabs.delete(id);
  if (!tabs.size) createTab();
  else if (activeId === id) activate(neighbor);
}
function setTitle(tab, title) {
  tab.title = title || 'New tab';
  tab.titleNode.textContent = tab.title;
  if (tab.id === activeId) updateNavigation();
}
function attachView(tab, url) {
  const view = document.createElement('webview');
  view.className = 'webview';
  view.setAttribute('partition', 'persist:sreon');
  view.setAttribute('src', url);
  view.addEventListener('did-start-loading', () => { tab.loading = true; if (tab.id === activeId) updateNavigation(); });
  view.addEventListener('did-stop-loading', () => { tab.loading = false; if (tab.id === activeId) updateNavigation(); });
  view.addEventListener('page-title-updated', event => setTitle(tab, event.title));
  const navigated = event => {
    if (!/^https?:\/\//i.test(event.url)) return;
    tab.url = event.url;
    if (tab.id === activeId) updateNavigation();
  };
  view.addEventListener('did-navigate', navigated);
  view.addEventListener('did-navigate-in-page', navigated);
  view.addEventListener('did-fail-load', event => {
    if (event.isMainFrame && event.errorCode !== -3) setTitle(tab, 'Unable to load page');
  });
  tab.view = view;
  views.append(view);
}
function navigate(value) {
  const url = toDestination(value);
  if (!url) return;
  const tab = current();
  tab.url = url;
  tab.isHome = false;
  setTitle(tab, 'Loading…');
  if (tab.view) tab.view.loadURL(url).catch(console.error);
  else attachView(tab, url);
  activate(tab.id);
  address.blur();
}
function goHome() {
  const tab = current();
  tab.isHome = true; tab.loading = false; tab.url = '';
  setTitle(tab, 'New tab');
  activate(tab.id);
}
function reload() { const tab = current(); if (!tab.isHome && tab.view) tab.view.reload(); }
$('new-tab').addEventListener('click', createTab);
$('address-form').addEventListener('submit', event => { event.preventDefault(); navigate(address.value); });
$('home-form').addEventListener('submit', event => { event.preventDefault(); navigate($('home-input').value); });
$('home').addEventListener('click', event => {
  const link = event.target.closest('[data-url]');
  if (link) navigate(link.dataset.url);
});
$('back').addEventListener('click', () => { const tab = current(); if (!tab.isHome && tab.view?.canGoBack()) tab.view.goBack(); });
$('forward').addEventListener('click', () => { const tab = current(); if (!tab.isHome && tab.view?.canGoForward()) tab.view.goForward(); });
$('reload').addEventListener('click', reload);
$('home').addEventListener('click', goHome);
document.addEventListener('keydown', event => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 'l') { event.preventDefault(); address.focus(); address.select(); }
  if (mod && event.key.toLowerCase() === 't') { event.preventDefault(); createTab(); }
  if (mod && event.key.toLowerCase() === 'w') { event.preventDefault(); closeTab(activeId); }
  if (mod && event.key.toLowerCase() === 'r') { event.preventDefault(); reload(); }
  if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); $('back').click(); }
  if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); $('forward').click(); }
  if (event.key === 'Escape' && document.activeElement === address) address.blur();
});
createTab();
