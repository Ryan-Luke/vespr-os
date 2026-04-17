const { app, BrowserWindow, Tray, Menu, nativeImage, shell, ipcMain } = require("electron")
const path = require("path")
const { autoUpdater } = require("electron-updater")

let mainWindow = null
let tray = null

// Store window state
const Store = require("electron-store")
const store = new Store({
  defaults: {
    windowBounds: { width: 1280, height: 800, x: undefined, y: undefined },
  },
})

function createWindow() {
  const { width, height, x, y } = store.get("windowBounds")

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset", // native macOS title bar
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: "#09090b", // match dark theme
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../public/icon.png"),
    show: false, // show after ready-to-show
  })

  // Load the Next.js app
  const isDev = process.env.NODE_ENV === "development"
  const port = process.env.PORT || 3001

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${port}`)
    // Open DevTools in dev
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    // In production, load from the built Next.js export or a hosted URL
    mainWindow.loadURL(process.env.VESPR_URL || "https://app.vespr.com")
  }

  // Show window when ready (prevents white flash)
  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
  })

  // Save window position/size on close
  mainWindow.on("close", () => {
    store.set("windowBounds", mainWindow.getBounds())
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })
}

// System tray
function createTray() {
  const iconPath = path.join(__dirname, "../public/tray-icon.png")
  // Create a simple tray icon (16x16 or 22x22)
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open VESPR", click: () => { if (mainWindow) mainWindow.show() } },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ])

  tray.setToolTip("VESPR")
  tray.setContextMenu(contextMenu)
  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    }
  })
}

// App lifecycle
app.whenReady().then(() => {
  createWindow()
  createTray()

  // Auto-update check (production only)
  if (process.env.NODE_ENV !== "development") {
    autoUpdater.checkForUpdatesAndNotify()
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// Auto-updater events
autoUpdater.on("update-available", () => {
  if (mainWindow) mainWindow.webContents.send("update-available")
})

autoUpdater.on("update-downloaded", () => {
  if (mainWindow) mainWindow.webContents.send("update-downloaded")
})

// IPC handlers
ipcMain.handle("app-version", () => app.getVersion())
ipcMain.handle("check-for-updates", () => autoUpdater.checkForUpdatesAndNotify())
ipcMain.handle("install-update", () => autoUpdater.quitAndInstall())
