# SREON Browser V3

A small Electron desktop browser with tabs, an address/search bar, navigation controls and a local new-tab page. This repository originally contained only this README; version 0.1.0 is a new baseline rather than a patch to an existing app.

## Startup

The splash is shown while the hidden main window loads. It closes when the main window is ready to show **or** its local page finishes loading. If loading fails, an error page replaces it. A 12-second watchdog releases the splash even if Electron never reports readiness; closing the main window during startup also closes the splash. See `src/boot.js` and `test/boot.test.js`.

## Development

Requires Node.js 22+.

```sh
npm ci
npm test
npm start
```

The browser opens HTTP(S) sites in sandboxed webviews without Node integration or a preload. It does not support other URL schemes. The new-tab page works offline, but browsing/searching requires internet access. This is an initial browser shell, not a privacy or security-audited general-purpose browser.

## Installers

Build on each native platform (or use the **Package desktop apps** GitHub Actions workflow on a pull request to `main`):

```sh
npm run dist:linux  # x64 AppImage
npm run dist:win    # x64 NSIS setup .exe
npm run dist:mac    # universal macOS .dmg, on macOS only
```

Installers are written to `release/` (ignored by Git). The matrix runs tests before packaging each platform. PR builds upload workflow artifacts (retained for 14 days); successful same-repository PR builds also attach all three installers to a **draft**, unsigned preview release. This is not published as a final release automatically.

### Signing and release readiness

Without signing certificates, the Windows installer and macOS DMG are **unsigned**. macOS Gatekeeper and Windows SmartScreen can warn or block installs. For a public release, provide `MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD` and `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` as GitHub Actions secrets, and configure Apple notarization for the macOS build. Test each installer on its native OS before publishing. Do not describe unsigned/unnotarized builds as trusted installers.
