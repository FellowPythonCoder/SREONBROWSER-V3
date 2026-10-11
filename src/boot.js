'use strict';

/**
 * Manage the startup hand-off in one place. Register listeners before starting
 * the load: a fast load must not race the splash cleanup. The timeout is a
 * last-resort exit from the splash, not a replacement for load events.
 */
function startBoot({ mainWindow, splashWindow, load, onFailure = () => {},
  timeoutMs = 12000, logger = console }) {
  if (!mainWindow || !splashWindow || typeof load !== 'function') {
    throw new TypeError('startBoot needs both windows and a load function');
  }

  let finished = false;
  let timer;
  const closeSplash = () => {
    if (!splashWindow.isDestroyed()) splashWindow.close();
  };
  const cleanup = () => {
    clearTimeout(timer);
    mainWindow.removeListener('ready-to-show', onReady);
    mainWindow.removeListener('closed', onClosed);
    mainWindow.webContents.removeListener('did-finish-load', onLoaded);
    mainWindow.webContents.removeListener('did-fail-load', onFailed);
  };
  const reveal = (reason) => {
    if (finished) return;
    finished = true;
    cleanup();
    try {
      if (!mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    } finally {
      // Even if showing the main window throws, the splash cannot be stranded.
      closeSplash();
    }
    logger.info?.(`Startup hand-off: ${reason}`);
  };
  const failure = (message) => {
    if (finished) return;
    logger.error?.(`Startup failed: ${message}`);
    try { onFailure(message); }
    catch (error) { logger.error?.('Could not show startup error', error); }
    reveal('failure');
  };
  const onReady = () => reveal('ready-to-show');
  const onLoaded = () => reveal('did-finish-load');
  const onFailed = (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame) failure(`${description || 'Page load failed'} (${code})`);
  };
  const onClosed = () => {
    if (finished) return;
    finished = true;
    cleanup();
    closeSplash();
  };

  mainWindow.on('ready-to-show', onReady);
  mainWindow.on('closed', onClosed);
  mainWindow.webContents.on('did-finish-load', onLoaded);
  mainWindow.webContents.on('did-fail-load', onFailed);
  timer = setTimeout(() => failure('Startup timed out'), timeoutMs);
  try { Promise.resolve(load()).catch(error => failure(error.message || String(error))); }
  catch (error) { failure(error.message || String(error)); }
  return { reveal, dispose: onClosed };
}

module.exports = { startBoot };
