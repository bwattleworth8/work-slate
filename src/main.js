const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, nativeTheme, screen, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("node:path");
const {
  getPublicSettings,
  loadCredentials,
  loadSettings,
  saveCredentials,
  saveSettings
} = require("./settingsStore");
const { TrelloClient } = require("./trelloClient");

let mainWindow;
let focusTimerWindow;
let tray;
let applyingWindowModeBounds = false;
let windowModeBoundsSaveTimer = null;
let floatingTimerBoundsSaveTimer = null;
let floatingTimerDragState = null;
let latestFocusTimerState = null;
let updaterSetupComplete = false;
let currentUpdateStatus = null;

const APP_ICON_DATA_URL =
  "data:image/png;base64,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";

const WINDOW_MODES = {
  focus: {
    width: 420,
    height: 880,
    minWidth: 380,
    minHeight: 560
  },
  planning: {
    width: 720,
    height: 780,
    minWidth: 320,
    minHeight: 420
  }
};

const FLOATING_TIMER_WINDOW = {
  width: 156,
  height: 62,
  margin: 12
};
const FLOATING_TIMER_ALWAYS_ON_TOP_LEVEL = "screen-saver";

const ACTIVE_UPDATE_STATES = new Set(["checking", "downloading"]);
const UPDATE_RELEASE_ACCESS_MESSAGE =
  "Could not read published GitHub releases. Make sure bwattleworth8/work-slate is public and the release is published, not draft.";

function getUpdateVersion(info) {
  return String(info?.version || info?.tag || "").trim();
}

function getUpdateReleaseDate(info) {
  return String(info?.releaseDate || "").trim();
}

function formatUpdateError(error) {
  const message = String(error?.message || error || "Unknown update error").trim();
  return message || "Unknown update error";
}

function formatUpdateFailure(prefix, error) {
  const message = formatUpdateError(error);

  if (
    /\b404\b/.test(message) &&
    /github\.com\/bwattleworth8\/work-slate\/releases\.atom/.test(message)
  ) {
    return `${prefix}: ${UPDATE_RELEASE_ACCESS_MESSAGE}`;
  }

  const firstLine = message.split(/\r?\n/).find(Boolean) || message;
  return `${prefix}: ${firstLine}`;
}

function buildUpdateStatus(overrides = {}) {
  const current = currentUpdateStatus || {};
  const defaultState = app.isPackaged ? "idle" : "unavailable";
  const defaultMessage = app.isPackaged
    ? "Ready to check for updates."
    : "Updates are available in packaged builds.";
  const state = overrides.state || current.state || defaultState;
  const canCheck = app.isPackaged && !ACTIVE_UPDATE_STATES.has(state);

  return {
    state,
    message: overrides.message || current.message || defaultMessage,
    currentVersion: app.getVersion(),
    updateVersion: overrides.updateVersion ?? current.updateVersion ?? "",
    releaseDate: overrides.releaseDate ?? current.releaseDate ?? "",
    progress: overrides.progress === undefined ? current.progress || null : overrides.progress,
    canCheck: overrides.canCheck ?? canCheck,
    canDownload: overrides.canDownload ?? false,
    canInstall: overrides.canInstall ?? false
  };
}

function setUpdateStatus(overrides = {}) {
  currentUpdateStatus = buildUpdateStatus(overrides);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("appUpdate:status", currentUpdateStatus);
  }

  return currentUpdateStatus;
}

function getCurrentUpdateStatus() {
  return currentUpdateStatus || buildUpdateStatus();
}

function setupAutoUpdater() {
  if (updaterSetupComplete) {
    return;
  }

  updaterSetupComplete = true;
  setUpdateStatus();

  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    setUpdateStatus({
      state: "checking",
      message: "Checking for updates...",
      progress: null,
      canCheck: false
    });
  });

  autoUpdater.on("update-available", (info) => {
    const updateVersion = getUpdateVersion(info);

    setUpdateStatus({
      state: "available",
      message: updateVersion
        ? `Update ${updateVersion} is available.`
        : "An update is available.",
      updateVersion,
      releaseDate: getUpdateReleaseDate(info),
      progress: null,
      canCheck: true,
      canDownload: true
    });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateStatus({
      state: "not-available",
      message: "Work Slate is up to date.",
      updateVersion: "",
      releaseDate: "",
      progress: null,
      canCheck: true
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.max(0, Math.min(100, Number(progress?.percent || 0)));

    setUpdateStatus({
      state: "downloading",
      message: `Downloading update ${Math.round(percent)}%...`,
      progress: {
        percent
      },
      canCheck: false
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    const updateVersion = getUpdateVersion(info);

    setUpdateStatus({
      state: "downloaded",
      message: updateVersion
        ? `Update ${updateVersion} is ready. Restart to install.`
        : "Update is ready. Restart to install.",
      updateVersion,
      releaseDate: getUpdateReleaseDate(info),
      progress: null,
      canCheck: true,
      canInstall: true
    });
  });

  autoUpdater.on("error", (error) => {
    setUpdateStatus({
      state: "error",
      message: formatUpdateFailure("Update failed", error),
      progress: null,
      canCheck: true
    });
  });
}

async function checkForAppUpdates() {
  const status = getCurrentUpdateStatus();

  if (!app.isPackaged) {
    return setUpdateStatus({
      state: "unavailable",
      message: "Updates are available after building the packaged app.",
      canCheck: false
    });
  }

  if (ACTIVE_UPDATE_STATES.has(status.state)) {
    return status;
  }

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    return setUpdateStatus({
      state: "error",
      message: formatUpdateFailure("Update check failed", error),
      progress: null,
      canCheck: true
    });
  }

  return getCurrentUpdateStatus();
}

async function downloadAppUpdate() {
  const status = getCurrentUpdateStatus();

  if (!status.canDownload) {
    return setUpdateStatus({
      state: "error",
      message: "No update is ready to download.",
      canCheck: true
    });
  }

  try {
    setUpdateStatus({
      state: "downloading",
      message: "Downloading update...",
      progress: {
        percent: 0
      },
      canCheck: false
    });
    await autoUpdater.downloadUpdate();
  } catch (error) {
    return setUpdateStatus({
      state: "error",
      message: formatUpdateFailure("Update download failed", error),
      progress: null,
      canCheck: true
    });
  }

  return getCurrentUpdateStatus();
}

function installAppUpdate() {
  const status = getCurrentUpdateStatus();

  if (!status.canInstall) {
    return setUpdateStatus({
      state: "error",
      message: "No downloaded update is ready to install.",
      canCheck: true
    });
  }

  saveWindowBounds();
  app.isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
  return status;
}

function createAppIcon(size) {
  const icon = nativeImage.createFromDataURL(APP_ICON_DATA_URL);
  return size ? icon.resize({ width: size, height: size }) : icon;
}

function createWindow() {
  const settings = loadSettings();
  applyNativeTheme(settings.theme);
  const viewMode = normalizeViewMode(settings.viewMode);
  const bounds = getWindowBoundsForMode(settings, viewMode);
  const modeConfig = WINDOW_MODES[viewMode];

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: modeConfig.minWidth,
    minHeight: modeConfig.minHeight,
    title: "Work Slate",
    icon: createAppIcon(),
    autoHideMenuBar: true,
    backgroundColor: getWindowBackgroundColor(settings.theme),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.once("did-finish-load", () => {
    setUpdateStatus();
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/trello\.com\//.test(String(url))) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  mainWindow.on("close", () => {
    saveWindowBounds();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    closeFloatingTimerWindow();
  });

  mainWindow.on("resize", saveWindowBounds);
  mainWindow.on("move", saveWindowBounds);
  mainWindow.on("blur", updateFloatingTimerVisibility);
  mainWindow.on("focus", hideFloatingTimerWindow);
  mainWindow.on("minimize", updateFloatingTimerVisibility);
  mainWindow.on("restore", updateFloatingTimerVisibility);

  if (viewMode === "planning") {
    maximizePlanningWindow();
  }
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (applyingWindowModeBounds || mainWindow.isFullScreen() || mainWindow.isMaximized()) {
    return;
  }

  const settings = loadSettings();
  const viewMode = normalizeViewMode(settings.viewMode);
  const bounds = mainWindow.getBounds();

  saveSettings({
    windowBounds: bounds,
    windowBoundsByMode: {
      [viewMode]: bounds
    }
  });
}

function normalizeViewMode(viewMode) {
  return viewMode === "focus" ? "focus" : "planning";
}

function normalizeTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

function applyNativeTheme(theme) {
  nativeTheme.themeSource = normalizeTheme(theme);
}

function getWindowBackgroundColor(theme) {
  return normalizeTheme(theme) === "light" ? "#f4f7fb" : "#11161d";
}

function getWindowBoundsForMode(settings, viewMode, currentBounds = {}) {
  const modeConfig = WINDOW_MODES[viewMode];
  const savedBounds = settings.windowBoundsByMode?.[viewMode] || {};
  const legacyBounds = viewMode === "planning" ? settings.windowBounds || {} : {};

  if (viewMode === "focus") {
    const workArea = getDisplayWorkArea(currentBounds, savedBounds);
    const margin = 8;
    const availableWidth = Math.max(1, workArea.width - margin * 2);
    const availableHeight = Math.max(1, workArea.height - margin * 2);
    const width = Math.max(
      Math.min(modeConfig.width, availableWidth),
      Math.min(modeConfig.minWidth, availableWidth)
    );

    return {
      x: workArea.x + margin,
      y: workArea.y + margin,
      width,
      height: availableHeight
    };
  }

  const bounds = {
    ...modeConfig,
    ...legacyBounds,
    ...savedBounds
  };

  return {
    x: bounds.x ?? currentBounds.x,
    y: bounds.y ?? currentBounds.y,
    width: Math.max(bounds.width || modeConfig.width, modeConfig.minWidth),
    height: Math.max(bounds.height || modeConfig.height, modeConfig.minHeight)
  };
}

function getDisplayWorkArea(currentBounds = {}, savedBounds = {}) {
  const displayBounds = {
    x: currentBounds.x ?? savedBounds.x ?? 0,
    y: currentBounds.y ?? savedBounds.y ?? 0,
    width: currentBounds.width ?? savedBounds.width ?? WINDOW_MODES.focus.width,
    height: currentBounds.height ?? savedBounds.height ?? WINDOW_MODES.focus.height
  };

  return screen.getDisplayMatching(displayBounds).workArea;
}

function createFloatingTimerWindow() {
  if (focusTimerWindow && !focusTimerWindow.isDestroyed()) {
    return focusTimerWindow;
  }

  const bounds = getFloatingTimerInitialBounds();

  focusTimerWindow = new BrowserWindow({
    width: FLOATING_TIMER_WINDOW.width,
    height: FLOATING_TIMER_WINDOW.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: false,
    title: "Work Slate Timer",
    icon: createAppIcon(),
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "floatingTimerPreload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  focusTimerWindow.loadFile(path.join(__dirname, "renderer", "floating-timer.html"));
  enforceFloatingTimerAlwaysOnTop(focusTimerWindow);
  focusTimerWindow.on("show", () => enforceFloatingTimerAlwaysOnTop(focusTimerWindow));
  focusTimerWindow.on("move", saveFloatingTimerBounds);
  focusTimerWindow.on("closed", () => {
    floatingTimerDragState = null;
    focusTimerWindow = null;
  });
  focusTimerWindow.webContents.on("did-finish-load", sendFloatingTimerState);

  return focusTimerWindow;
}

function enforceFloatingTimerAlwaysOnTop(timerWindow = focusTimerWindow) {
  if (!timerWindow || timerWindow.isDestroyed()) {
    return;
  }

  timerWindow.setAlwaysOnTop(true, FLOATING_TIMER_ALWAYS_ON_TOP_LEVEL);

  if (process.platform === "darwin") {
    timerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  if (timerWindow.isVisible() && typeof timerWindow.moveTop === "function") {
    timerWindow.moveTop();
  }
}

function getFloatingTimerInitialBounds() {
  const settings = loadSettings();
  const savedBounds = settings.floatingTimerBounds || {};
  const mainBounds =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow.getBounds()
      : {
          x: 0,
          y: 0,
          width: FLOATING_TIMER_WINDOW.width,
          height: FLOATING_TIMER_WINDOW.height
        };
  const matchingBounds = {
    x: Number.isFinite(savedBounds.x) ? savedBounds.x : mainBounds.x,
    y: Number.isFinite(savedBounds.y) ? savedBounds.y : mainBounds.y,
    width: FLOATING_TIMER_WINDOW.width,
    height: FLOATING_TIMER_WINDOW.height
  };
  const workArea = screen.getDisplayMatching(matchingBounds).workArea;
  const defaultBounds = {
    x: workArea.x + FLOATING_TIMER_WINDOW.margin,
    y:
      workArea.y +
      workArea.height -
      FLOATING_TIMER_WINDOW.height -
      FLOATING_TIMER_WINDOW.margin,
    width: FLOATING_TIMER_WINDOW.width,
    height: FLOATING_TIMER_WINDOW.height
  };

  return clampFloatingTimerBounds(
    {
      ...defaultBounds,
      x: Number.isFinite(savedBounds.x) ? savedBounds.x : defaultBounds.x,
      y: Number.isFinite(savedBounds.y) ? savedBounds.y : defaultBounds.y
    },
    workArea
  );
}

function clampFloatingTimerBounds(bounds, workArea) {
  const maxX = workArea.x + workArea.width - FLOATING_TIMER_WINDOW.width;
  const maxY = workArea.y + workArea.height - FLOATING_TIMER_WINDOW.height;

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), Math.max(workArea.x, maxX)),
    y: Math.min(Math.max(bounds.y, workArea.y), Math.max(workArea.y, maxY))
  };
}

function saveFloatingTimerBounds() {
  if (!focusTimerWindow || focusTimerWindow.isDestroyed()) {
    return;
  }

  if (floatingTimerBoundsSaveTimer) {
    clearTimeout(floatingTimerBoundsSaveTimer);
  }

  floatingTimerBoundsSaveTimer = setTimeout(() => {
    floatingTimerBoundsSaveTimer = null;

    if (!focusTimerWindow || focusTimerWindow.isDestroyed()) {
      return;
    }

    const bounds = focusTimerWindow.getBounds();
    saveSettings({
      floatingTimerBounds: {
        x: bounds.x,
        y: bounds.y
      }
    });
  }, 180);
}

function startFloatingTimerDrag() {
  if (!focusTimerWindow || focusTimerWindow.isDestroyed()) {
    return;
  }

  const [windowX, windowY] = focusTimerWindow.getPosition();
  const cursor = screen.getCursorScreenPoint();

  floatingTimerDragState = {
    windowX,
    windowY,
    cursorX: cursor.x,
    cursorY: cursor.y
  };
  enforceFloatingTimerAlwaysOnTop();
}

function moveFloatingTimerDrag() {
  if (!focusTimerWindow || focusTimerWindow.isDestroyed() || !floatingTimerDragState) {
    return;
  }

  const cursor = screen.getCursorScreenPoint();
  const nextBounds = {
    x: Math.round(floatingTimerDragState.windowX + cursor.x - floatingTimerDragState.cursorX),
    y: Math.round(floatingTimerDragState.windowY + cursor.y - floatingTimerDragState.cursorY),
    width: FLOATING_TIMER_WINDOW.width,
    height: FLOATING_TIMER_WINDOW.height
  };
  const clampedBounds = clampFloatingTimerBounds(
    nextBounds,
    screen.getDisplayMatching(nextBounds).workArea
  );

  focusTimerWindow.setBounds(
    {
      ...clampedBounds,
      width: FLOATING_TIMER_WINDOW.width,
      height: FLOATING_TIMER_WINDOW.height
    },
    false
  );
  enforceFloatingTimerAlwaysOnTop();
}

function endFloatingTimerDrag() {
  if (!floatingTimerDragState) {
    return;
  }

  floatingTimerDragState = null;
  saveFloatingTimerBounds();
}

function showFloatingTimerWindow() {
  const timerWindow = createFloatingTimerWindow();
  sendFloatingTimerState();

  if (timerWindow.isVisible()) {
    enforceFloatingTimerAlwaysOnTop(timerWindow);
    return;
  }

  if (typeof timerWindow.showInactive === "function") {
    timerWindow.showInactive();
  } else {
    timerWindow.show();
  }
  enforceFloatingTimerAlwaysOnTop(timerWindow);
}

function hideFloatingTimerWindow() {
  if (!focusTimerWindow || focusTimerWindow.isDestroyed() || !focusTimerWindow.isVisible()) {
    return;
  }

  focusTimerWindow.hide();
}

function closeFloatingTimerWindow() {
  if (!focusTimerWindow || focusTimerWindow.isDestroyed()) {
    return;
  }

  focusTimerWindow.close();
}

function updateFloatingTimerVisibility() {
  if (shouldShowFloatingTimer()) {
    showFloatingTimerWindow();
  } else {
    hideFloatingTimerWindow();
  }
}

function shouldShowFloatingTimer() {
  return Boolean(
    mainWindow &&
      !mainWindow.isDestroyed() &&
      normalizeViewMode(loadSettings().viewMode) === "focus" &&
      !mainWindow.isFocused() &&
      latestFocusTimerState?.hasFocusTask
  );
}

function normalizeFocusTimerState(timerState) {
  const elapsedMs = Number(timerState?.elapsedMs);
  const durationMs = Number(timerState?.durationMs);
  const startedAt = Number(timerState?.startedAt);

  return {
    hasFocusTask: Boolean(timerState?.hasFocusTask),
    taskName: String(timerState?.taskName || "").slice(0, 180),
    mode: String(timerState?.mode || "stopwatch"),
    theme: normalizeTheme(timerState?.theme),
    isRunning: Boolean(timerState?.isRunning),
    startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : null,
    elapsedMs: Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0,
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null,
    completed: Boolean(timerState?.completed)
  };
}

function sendFloatingTimerState() {
  if (!focusTimerWindow || focusTimerWindow.isDestroyed()) {
    return;
  }

  if (focusTimerWindow.isVisible()) {
    enforceFloatingTimerAlwaysOnTop();
  }

  focusTimerWindow.webContents.send("floatingTimer:state", latestFocusTimerState);
}

function resizeWindowForMode(viewMode) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (viewMode === "planning") {
    maximizePlanningWindow();
    return;
  }

  const modeConfig = WINDOW_MODES[viewMode];
  const currentBounds = mainWindow.getBounds();
  const nextBounds = getWindowBoundsForMode(loadSettings(), viewMode, currentBounds);
  const targetBounds = {
    ...nextBounds,
    x: nextBounds.x ?? currentBounds.x,
    y: nextBounds.y ?? currentBounds.y
  };

  if (viewMode === "focus") {
    restoreWindowForExplicitBounds();
  }

  applyingWindowModeBounds = true;
  mainWindow.setMinimumSize(modeConfig.minWidth, modeConfig.minHeight);
  mainWindow.setBounds(targetBounds, false);
  saveWindowBoundsAfterModeResize();

  if (viewMode === "focus") {
    setTimeout(enforceFocusModeBounds, 150);
  }
}

function maximizePlanningWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  const modeConfig = WINDOW_MODES.planning;
  applyingWindowModeBounds = true;
  mainWindow.setMinimumSize(modeConfig.minWidth, modeConfig.minHeight);
  mainWindow.maximize();
  saveWindowBoundsAfterModeResize();
}

function restoreWindowForExplicitBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }
}

function saveWindowBoundsAfterModeResize() {
  if (windowModeBoundsSaveTimer) {
    clearTimeout(windowModeBoundsSaveTimer);
  }

  windowModeBoundsSaveTimer = setTimeout(() => {
    windowModeBoundsSaveTimer = null;
    applyingWindowModeBounds = false;
    saveWindowBounds();
  }, 120);
}

function enforceFocusModeBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (normalizeViewMode(loadSettings().viewMode) !== "focus") {
    return;
  }

  const modeConfig = WINDOW_MODES.focus;
  const currentBounds = mainWindow.getBounds();
  const nextBounds = getWindowBoundsForMode(loadSettings(), "focus", currentBounds);

  restoreWindowForExplicitBounds();
  applyingWindowModeBounds = true;
  mainWindow.setMinimumSize(modeConfig.minWidth, modeConfig.minHeight);
  mainWindow.setBounds(
    {
      ...nextBounds,
      x: nextBounds.x ?? currentBounds.x,
      y: nextBounds.y ?? currentBounds.y
    },
    false
  );
  saveWindowBoundsAfterModeResize();
}

function createTray() {
  const trayIcon = createAppIcon(16);

  tray = new Tray(trayIcon);
  tray.setTitle("Work Slate");
  tray.setToolTip("Work Slate");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => {
    showMainWindow();
  });
}

function buildTrayMenu() {
  const settings = loadSettings();

  return Menu.buildFromTemplate([
    {
      label: "Show Work Slate",
      click: showMainWindow
    },
    {
      label: "Refresh Tasks",
      click: () => {
        showMainWindow();
        mainWindow?.webContents.send("tasks:refresh");
      }
    },
    {
      label: "Settings",
      click: () => {
        setViewMode("planning");
        showMainWindow();
        mainWindow?.webContents.send("settings:open");
      }
    },
    { type: "separator" },
    {
      label: "Focus Mode",
      type: "radio",
      checked: normalizeViewMode(settings.viewMode) === "focus",
      click: () => {
        setViewMode("focus");
      }
    },
    {
      label: "Plan Mode",
      type: "radio",
      checked: normalizeViewMode(settings.viewMode) === "planning",
      click: () => {
        setViewMode("planning");
      }
    },
    {
      label: "Light Mode",
      type: "checkbox",
      checked: normalizeTheme(settings.theme) === "light",
      click: (item) => {
        setTheme(item.checked ? "light" : "dark");
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function showMainWindow() {
  if (!mainWindow) {
    return;
  }

  mainWindow.show();
  mainWindow.focus();
  hideFloatingTimerWindow();
}

function setViewMode(viewMode) {
  const nextViewMode = normalizeViewMode(viewMode);

  if (mainWindow && !mainWindow.isDestroyed()) {
    saveWindowBounds();
  }

  saveSettings({
    viewMode: nextViewMode
  });

  resizeWindowForMode(nextViewMode);

  const publicSettings = getPublicSettings();
  mainWindow?.webContents.send("viewMode:changed", publicSettings);
  updateFloatingTimerVisibility();

  if (tray) {
    tray.setContextMenu(buildTrayMenu());
  }

  return publicSettings;
}

function setTheme(theme) {
  const nextTheme = normalizeTheme(theme);
  saveSettings({
    theme: nextTheme
  });
  applyNativeTheme(nextTheme);
  mainWindow?.setBackgroundColor(getWindowBackgroundColor(nextTheme));

  const publicSettings = getPublicSettings();
  mainWindow?.webContents.send("theme:changed", publicSettings);

  if (tray) {
    tray.setContextMenu(buildTrayMenu());
  }

  return publicSettings;
}

function normalizeQueueName(queueName) {
  if (queueName === "today" || queueName === "week") {
    return queueName;
  }

  throw new Error("Unknown queue.");
}

function normalizeCardId(cardId) {
  const normalizedCardId = String(cardId || "").trim();

  if (!normalizedCardId) {
    throw new Error("Missing Trello card id.");
  }

  return normalizedCardId;
}

function dedupeQueue(ids) {
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

function updateQueue(queueName, updater) {
  const normalizedQueueName = normalizeQueueName(queueName);
  const settings = loadSettings();
  const currentQueue = dedupeQueue(settings.queues?.[normalizedQueueName] || []);
  const nextQueue = dedupeQueue(updater(currentQueue));

  saveSettings({
    queues: {
      ...settings.queues,
      [normalizedQueueName]: nextQueue
    }
  });

  return getPublicSettings();
}

function addCardToQueue(queueName, cardId) {
  const normalizedCardId = normalizeCardId(cardId);
  return updateQueue(queueName, (queue) =>
    queue.includes(normalizedCardId) ? queue : [...queue, normalizedCardId]
  );
}

function removeCardFromQueue(queueName, cardId) {
  const normalizedCardId = normalizeCardId(cardId);
  return updateQueue(queueName, (queue) => queue.filter((id) => id !== normalizedCardId));
}

function moveCardInQueue(queueName, cardId, direction) {
  const normalizedCardId = normalizeCardId(cardId);
  const offset = Number(direction) < 0 ? -1 : 1;

  return updateQueue(queueName, (queue) => {
    const currentIndex = queue.indexOf(normalizedCardId);
    if (currentIndex === -1) {
      return queue;
    }

    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= queue.length) {
      return queue;
    }

    const nextQueue = [...queue];
    [nextQueue[currentIndex], nextQueue[nextIndex]] = [nextQueue[nextIndex], nextQueue[currentIndex]];
    return nextQueue;
  });
}

function moveCardBetweenQueues(sourceQueueName, targetQueueName, cardId) {
  const normalizedSourceQueueName = normalizeQueueName(sourceQueueName);
  const normalizedTargetQueueName = normalizeQueueName(targetQueueName);
  const normalizedCardId = normalizeCardId(cardId);
  const settings = loadSettings();
  const sourceQueue = dedupeQueue(settings.queues?.[normalizedSourceQueueName] || []);
  const targetQueue = dedupeQueue(settings.queues?.[normalizedTargetQueueName] || []);
  const nextQueues = {
    ...settings.queues,
    [normalizedSourceQueueName]: sourceQueue.filter((id) => id !== normalizedCardId),
    [normalizedTargetQueueName]: targetQueue.includes(normalizedCardId)
      ? targetQueue
      : [...targetQueue, normalizedCardId]
  };

  saveSettings({
    queues: nextQueues
  });

  return getPublicSettings();
}

function reorderQueue(queueName, cardIds) {
  if (!Array.isArray(cardIds)) {
    throw new Error("Queue order must be an array.");
  }

  return updateQueue(queueName, () => cardIds);
}

function pruneQueues(validCardIds) {
  const validCardIdSet = new Set((validCardIds || []).map((id) => String(id || "").trim()).filter(Boolean));
  const settings = loadSettings();

  saveSettings({
    queues: {
      today: dedupeQueue(settings.queues?.today || []).filter((id) => validCardIdSet.has(id)),
      week: dedupeQueue(settings.queues?.week || []).filter((id) => validCardIdSet.has(id))
    }
  });

  return getPublicSettings();
}

function removeCardFromAllQueues(cardId) {
  const normalizedCardId = normalizeCardId(cardId);
  const settings = loadSettings();

  saveSettings({
    queues: {
      today: dedupeQueue(settings.queues?.today || []).filter((id) => id !== normalizedCardId),
      week: dedupeQueue(settings.queues?.week || []).filter((id) => id !== normalizedCardId)
    }
  });

  return getPublicSettings();
}

function getConfiguredClient() {
  return new TrelloClient(loadCredentials());
}

function registerIpcHandlers() {
  ipcMain.handle("settings:get", () => getPublicSettings());

  ipcMain.handle("settings:save", (_event, settings) => {
    const nextSettings = settings || {};
    const userName = String(nextSettings.userName || "").trim();
    const quickAddTemplateCardId = String(nextSettings.quickAdd?.templateCardId || "").trim();
    const quickAddTemplateCardName = String(nextSettings.quickAdd?.templateCardName || "").trim();
    const saved = saveSettings({
      userName,
      boardId: nextSettings.boardId || "",
      boardName: nextSettings.boardName || "",
      refreshMinutes: Number(nextSettings.refreshMinutes) || 5,
      quickAdd: {
        templateCardId: quickAddTemplateCardId,
        templateCardName: quickAddTemplateCardName
      }
    });

    return {
      ...getPublicSettings(),
      boardId: saved.boardId,
      boardName: saved.boardName
    };
  });

  ipcMain.handle("credentials:save", (_event, credentials) => {
    const apiKey = String(credentials?.apiKey || "").trim();
    const token = String(credentials?.token || "").trim();

    if (!apiKey || !token) {
      throw new Error("Enter both a Trello API key and token.");
    }

    saveCredentials({ apiKey, token });
    return getPublicSettings();
  });

  ipcMain.handle("trello:boards", async (_event, credentials) => {
    const client = credentials
      ? new TrelloClient({
          apiKey: String(credentials.apiKey || "").trim(),
          token: String(credentials.token || "").trim()
        })
      : getConfiguredClient();

    return client.getBoards();
  });

  ipcMain.handle("trello:cards", async () => {
    const settings = loadSettings();
    const client = getConfiguredClient();
    return client.getBoardCards(settings.boardId);
  });

  ipcMain.handle("trello:quickAddOptions", async (_event, payload) => {
    const settings = loadSettings();
    const boardId = String(payload?.boardId || settings.boardId || "").trim();
    const client = payload?.credentials
      ? new TrelloClient({
          apiKey: String(payload.credentials.apiKey || "").trim(),
          token: String(payload.credentials.token || "").trim()
        })
      : getConfiguredClient();
    const [lists, templates, labels, members, priorityField] = await Promise.all([
      client.getBoardLists(boardId),
      client.getBoardTemplateCards(boardId),
      client.getBoardLabels(boardId),
      client.getBoardMembers(boardId),
      client.getBoardPriorityField(boardId)
    ]);

    return {
      lists,
      templates,
      labels,
      members,
      priorityField
    };
  });

  ipcMain.handle("trello:quickAddCard", async (_event, payload) => {
    const settings = loadSettings();
    const client = getConfiguredClient();
    return client.createCardFromTemplate(
      settings.boardId,
      settings.quickAdd?.templateCardId,
      String(payload?.listId || "").trim(),
      payload?.name,
      {
        labelId: payload?.labelId,
        dueDate: payload?.dueDate,
        memberId: payload?.memberId,
        priorityOptionId: payload?.priorityOptionId
      }
    );
  });

  ipcMain.handle("trello:complete", async (_event, cardId) => {
    const client = getConfiguredClient();
    await client.completeCard(cardId);
    return {
      ok: true,
      settings: removeCardFromAllQueues(cardId)
    };
  });

  ipcMain.handle("trello:addTimeSpent", async (_event, cardId, minutes) => {
    const settings = loadSettings();
    const client = getConfiguredClient();
    return client.addTimeSpent(settings.boardId, cardId, minutes);
  });

  ipcMain.handle("trello:addComment", async (_event, cardId, text) => {
    const client = getConfiguredClient();
    await client.addCardComment(cardId, text);
    return {
      ok: true,
      cardId
    };
  });

  ipcMain.handle("shell:openExternal", (_event, url) => {
    if (!/^https:\/\/trello\.com\//.test(String(url))) {
      throw new Error("Only Trello links can be opened from Work Slate.");
    }

    return shell.openExternal(url);
  });

  ipcMain.handle("window:viewMode", (_event, viewMode) => setViewMode(viewMode));

  ipcMain.handle("settings:theme", (_event, theme) => setTheme(theme));

  ipcMain.handle("appUpdate:getStatus", () => getCurrentUpdateStatus());

  ipcMain.handle("appUpdate:check", () => checkForAppUpdates());

  ipcMain.handle("appUpdate:download", () => downloadAppUpdate());

  ipcMain.handle("appUpdate:install", () => installAppUpdate());

  ipcMain.on("focusTimer:update", (_event, timerState) => {
    latestFocusTimerState = normalizeFocusTimerState(timerState);
    sendFloatingTimerState();
    updateFloatingTimerVisibility();
  });

  ipcMain.handle("floatingTimer:getState", () => latestFocusTimerState);

  ipcMain.handle("floatingTimer:openMainWindow", () => {
    showMainWindow();
    return true;
  });

  ipcMain.on("floatingTimer:dragStart", startFloatingTimerDrag);

  ipcMain.on("floatingTimer:dragMove", moveFloatingTimerDrag);

  ipcMain.on("floatingTimer:dragEnd", endFloatingTimerDrag);

  ipcMain.handle("queues:add", (_event, queueName, cardId) => addCardToQueue(queueName, cardId));

  ipcMain.handle("queues:remove", (_event, queueName, cardId) =>
    removeCardFromQueue(queueName, cardId)
  );

  ipcMain.handle("queues:move", (_event, queueName, cardId, direction) =>
    moveCardInQueue(queueName, cardId, direction)
  );

  ipcMain.handle("queues:moveBetween", (_event, sourceQueueName, targetQueueName, cardId) =>
    moveCardBetweenQueues(sourceQueueName, targetQueueName, cardId)
  );

  ipcMain.handle("queues:reorder", (_event, queueName, cardIds) => reorderQueue(queueName, cardIds));

  ipcMain.handle("queues:prune", (_event, validCardIds) => pruneQueues(validCardIds));

  ipcMain.handle("window:hide", () => {
    mainWindow?.minimize();
  });
}

app.whenReady().then(() => {
  app.setName("Work Slate");
  app.setAppUserModelId("com.local.work-slate");
  applyNativeTheme(loadSettings().theme);
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  setupAutoUpdater();
  createWindow();
  createTray();

  if (app.isPackaged) {
    setTimeout(() => {
      checkForAppUpdates();
    }, 4000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showMainWindow();
    }
  });
});

app.on("before-quit", () => {
  app.isQuitting = true;
  saveWindowBounds();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
