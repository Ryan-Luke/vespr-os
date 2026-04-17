# VESPR Electron App

## Development
```bash
npm run electron:dev
```

## Building
```bash
# Mac
npm run electron:build:mac

# Windows
npm run electron:build:win

# Linux
npm run electron:build:linux
```

## Icons Required
Before building, create these icon files:
- `public/icon.png` -- 512x512 PNG (Linux)
- `public/icon.icns` -- macOS icon bundle
- `public/icon.ico` -- Windows icon
- `public/tray-icon.png` -- 16x16 or 22x22 for system tray

Use https://www.electron.build/icons for conversion tools.

## Auto-Updates
Auto-updates use GitHub Releases via electron-updater.
Set up a GitHub repo and push releases with `electron-builder --publish always`.
