const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taskWidget", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  saveCredentials: (credentials) => ipcRenderer.invoke("credentials:save", credentials),
  getBoards: (credentials) => ipcRenderer.invoke("trello:boards", credentials),
  getCards: () => ipcRenderer.invoke("trello:cards"),
  getQuickAddOptions: (payload) => ipcRenderer.invoke("trello:quickAddOptions", payload),
  quickAddCard: (payload) => ipcRenderer.invoke("trello:quickAddCard", payload),
  completeCard: (cardId) => ipcRenderer.invoke("trello:complete", cardId),
  addTimeSpent: (cardId, minutes) => ipcRenderer.invoke("trello:addTimeSpent", cardId, minutes),
  addComment: (cardId, text) => ipcRenderer.invoke("trello:addComment", cardId, text),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  setViewMode: (viewMode) => ipcRenderer.invoke("window:viewMode", viewMode),
  setTheme: (theme) => ipcRenderer.invoke("settings:theme", theme),
  getUpdateStatus: () => ipcRenderer.invoke("appUpdate:getStatus"),
  checkForUpdates: () => ipcRenderer.invoke("appUpdate:check"),
  downloadUpdate: () => ipcRenderer.invoke("appUpdate:download"),
  installUpdate: () => ipcRenderer.invoke("appUpdate:install"),
  updateFocusTimer: (timerState) => ipcRenderer.send("focusTimer:update", timerState),
  addToQueue: (queueName, cardId) => ipcRenderer.invoke("queues:add", queueName, cardId),
  removeFromQueue: (queueName, cardId) => ipcRenderer.invoke("queues:remove", queueName, cardId),
  moveQueueItem: (queueName, cardId, direction) =>
    ipcRenderer.invoke("queues:move", queueName, cardId, direction),
  moveBetweenQueues: (sourceQueueName, targetQueueName, cardId) =>
    ipcRenderer.invoke("queues:moveBetween", sourceQueueName, targetQueueName, cardId),
  reorderQueue: (queueName, cardIds) => ipcRenderer.invoke("queues:reorder", queueName, cardIds),
  pruneQueues: (validCardIds) => ipcRenderer.invoke("queues:prune", validCardIds),
  hide: () => ipcRenderer.invoke("window:hide"),
  onRefreshRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("tasks:refresh", listener);
    return () => ipcRenderer.removeListener("tasks:refresh", listener);
  },
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("settings:open", listener);
    return () => ipcRenderer.removeListener("settings:open", listener);
  },
  onViewModeChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("viewMode:changed", listener);
    return () => ipcRenderer.removeListener("viewMode:changed", listener);
  },
  onThemeChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("theme:changed", listener);
    return () => ipcRenderer.removeListener("theme:changed", listener);
  },
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("appUpdate:status", listener);
    return () => ipcRenderer.removeListener("appUpdate:status", listener);
  }
});
