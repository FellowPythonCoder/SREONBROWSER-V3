'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const { startBoot } = require('./boot');

const icon = path.join(__dirname, '..', 'assets', 'icon.png');
let mainWindow;

function safeHttpUrl(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

// Remote pages never get Node access or a preload, even if a renderer tries to
// add one. Only the packaged local UI can be the top-level application page.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (safeHttpUrl(url)) shell.openExternal(url).catch(console.error);
    return { action: 'deny' };
  });
  contents.on('will-attach-webview', (event, preferences, params) => {
    delete preferences.preload;
    delete preferences.preloadURL;
    preferences.nodeIntegration = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
    if (!safeHttpUrl(params.src)) event.preventDefault();
  });
  if (contents.getType() === 'window') {
    contents.on('will-navigate', (event) => event.preventDefault());
  } else if (contents.getType() === 'webview') {
    const preventUnsafeNavigation = (event, url) => {
      if (!safeHttpUrl(url)) event.preventDefault();
    };
    contents.on('will-navigate', preventUnsafeNavigation);
    contents.on('will-redirect', preventUnsafeNavigation);
  }
});

function createWindows() {
  const splashWindow = new BrowserWindow({
    width: 490, height: 320, frame: false, resizable: false, center: true,
    show: true, backgroundColor: '#0c1222', icon,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  // The splash is local and intentionally has no remote content.
  splashWindow.loadFile(path.join(__dirname, 'splash.html')).catch(console.error);

  mainWindow = new BrowserWindow({
    width: 1280, height: 840, minWidth: 720, minHeight: 520,
    show: false, backgroundColor: '#0b1020', title: 'SREON Browser', icon,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webviewTag: true
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  startBoot({
    mainWindow, splashWindow,
    load: () => mainWindow.loadFile(path.join(__dirname, 'index.html')),
    onFailure: (message) => {
      // A local fallback makes a failed boot actionable rather than leaving a
      // blank window. Query values are rendered with textContent, not HTML.
      if (!mainWindow.isDestroyed()) {
        mainWindow.loadFile(path.join(__dirname, 'startup-error.html'),
          { query: { message } }).catch(console.error);
      }
    }
  });
}

app.whenReady().then(() => {
  createWindows();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindows();
  });
}).catch(console.error);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
