const fs = require("node:fs");
const path = require("node:path");
const { app, safeStorage } = require("electron");

const SETTINGS_FILE = "settings.json";
const LEGACY_APP_NAME = "Trello Focus Widget";
let legacySettingsMigrationChecked = false;

const DEFAULT_SETTINGS = {
  windowBounds: {
    width: 420,
    height: 720
  },
  windowBoundsByMode: {
    focus: {
      width: 420,
      height: 880
    },
    planning: {
      width: 720,
      height: 780
    }
  },
  floatingTimerBounds: {},
  viewMode: "planning",
  theme: "dark",
  alwaysOnTop: false,
  refreshMinutes: 5,
  queues: {
    today: [],
    week: []
  },
  quickAdd: {
    templateCardId: "",
    templateCardName: ""
  },
  boardId: "",
  boardName: "",
  encryptedCredentials: null,
  plainCredentials: null
};

function getSettingsPath() {
  const settingsPath = path.join(app.getPath("userData"), SETTINGS_FILE);
  migrateLegacySettings(settingsPath);
  return settingsPath;
}

function migrateLegacySettings(settingsPath) {
  if (legacySettingsMigrationChecked) {
    return;
  }

  legacySettingsMigrationChecked = true;

  if (fs.existsSync(settingsPath)) {
    return;
  }

  const legacySettingsPath = path.join(app.getPath("appData"), LEGACY_APP_NAME, SETTINGS_FILE);

  if (!fs.existsSync(legacySettingsPath)) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.copyFileSync(legacySettingsPath, settingsPath);
  } catch {
    // If migration fails, fall back to default settings instead of blocking startup.
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function loadSettings() {
  const stored = readJson(getSettingsPath());

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    windowBounds: {
      ...DEFAULT_SETTINGS.windowBounds,
      ...(stored.windowBounds || {})
    },
    windowBoundsByMode: {
      ...DEFAULT_SETTINGS.windowBoundsByMode,
      ...(stored.windowBoundsByMode || {})
    },
    queues: {
      today: sanitizeQueueIds(stored.queues?.today),
      week: sanitizeQueueIds(stored.queues?.week)
    },
    quickAdd: sanitizeQuickAddSettings(stored.quickAdd)
  };
}

function saveSettings(nextSettings) {
  const current = loadSettings();
  const merged = {
    ...current,
    ...nextSettings,
    windowBounds: {
      ...current.windowBounds,
      ...(nextSettings.windowBounds || {})
    },
    windowBoundsByMode: {
      ...current.windowBoundsByMode,
      ...(nextSettings.windowBoundsByMode || {})
    },
    queues: {
      ...current.queues,
      ...(nextSettings.queues || {})
    },
    quickAdd: sanitizeQuickAddSettings({
      ...current.quickAdd,
      ...(nextSettings.quickAdd || {})
    })
  };

  writeJson(getSettingsPath(), merged);
  return merged;
}

function sanitizeQueueIds(ids) {
  if (!Array.isArray(ids)) {
    return [];
  }

  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

function sanitizeQuickAddSettings(quickAdd) {
  return {
    templateCardId: String(quickAdd?.templateCardId || "").trim(),
    templateCardName: String(quickAdd?.templateCardName || "").trim()
  };
}

function encryptCredentials(credentials) {
  const payload = JSON.stringify(credentials);

  if (safeStorage.isEncryptionAvailable()) {
    return {
      mode: "safeStorage",
      value: safeStorage.encryptString(payload).toString("base64")
    };
  }

  return null;
}

function decryptCredentials(encryptedCredentials) {
  if (!encryptedCredentials || encryptedCredentials.mode !== "safeStorage") {
    return null;
  }

  try {
    const encryptedBuffer = Buffer.from(encryptedCredentials.value, "base64");
    return JSON.parse(safeStorage.decryptString(encryptedBuffer));
  } catch {
    return null;
  }
}

function saveCredentials(credentials) {
  const encryptedCredentials = encryptCredentials(credentials);

  if (encryptedCredentials) {
    return saveSettings({
      encryptedCredentials,
      plainCredentials: null
    });
  }

  return saveSettings({
    encryptedCredentials: null,
    plainCredentials: credentials
  });
}

function loadCredentials() {
  const settings = loadSettings();
  const decrypted = decryptCredentials(settings.encryptedCredentials);

  if (decrypted) {
    return decrypted;
  }

  return settings.plainCredentials;
}

function getPublicSettings() {
  const settings = loadSettings();
  const credentials = loadCredentials();

  return {
    alwaysOnTop: settings.alwaysOnTop,
    viewMode: settings.viewMode,
    theme: settings.theme,
    refreshMinutes: settings.refreshMinutes,
    queues: settings.queues,
    quickAdd: settings.quickAdd,
    boardId: settings.boardId,
    boardName: settings.boardName,
    hasCredentials: Boolean(credentials?.apiKey && credentials?.token),
    encryptionAvailable: safeStorage.isEncryptionAvailable()
  };
}

module.exports = {
  getPublicSettings,
  loadCredentials,
  loadSettings,
  saveCredentials,
  saveSettings
};
