const state = {
  settings: null,
  tasks: [],
  activeFilter: "all",
  workspaceView: "dashboard",
  selectedListIds: new Set(),
  focusTask: null,
  nextSuggestion: null,
  timer: {
    isRunning: false,
    startedAt: null,
    elapsedMs: 0,
    intervalId: null,
    mode: "stopwatch",
    customMinutes: 25,
    completed: false
  },
  refreshTimer: null,
  knownBoards: [],
  quickAddOptions: {
    lists: [],
    templates: [],
    labels: [],
    members: [],
    priorityField: null
  },
  quickAddOptionsBoardId: "",
  pendingQuickAddTask: null,
  updateStatus: null,
  queueDrag: {
    queueName: null,
    cardId: null
  }
};

const LEGACY_FOCUS_NOTES_STORAGE_KEY = "trello-focus-widget:focus-notes";
const LEGACY_FOCUS_SESSIONS_STORAGE_KEY = "trello-focus-widget:focus-sessions";
const LEGACY_COMPLETED_TASKS_STORAGE_KEY = "trello-focus-widget:completed-tasks";
const FOCUS_NOTES_STORAGE_KEY = "work-slate:focus-notes";
const FOCUS_SESSIONS_STORAGE_KEY = "work-slate:focus-sessions";
const COMPLETED_TASKS_STORAGE_KEY = "work-slate:completed-tasks";
const FOCUS_NOTES_MAX_LENGTH = 1000;
const MAX_STORED_FOCUS_SESSIONS = 500;
const MAX_STORED_COMPLETED_TASKS = 500;
const DUE_SOON_DAYS = 3;
const TIMER_MODES = {
  stopwatch: null,
  "pomodoro-25": 25,
  "pomodoro-50": 50,
  "pomodoro-custom": null
};
const DEFAULT_CUSTOM_POMODORO_MINUTES = 25;
const MIN_CUSTOM_POMODORO_MINUTES = 1;
const MAX_CUSTOM_POMODORO_MINUTES = 240;

const elements = {
  setupPanel: document.querySelector("#setupPanel"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsButton: document.querySelector("#settingsButton"),
  updateButton: document.querySelector("#updateButton"),
  topModeButton: document.querySelector("#topModeButton"),
  modeButtons: [...document.querySelectorAll("[data-view-mode]")],
  themeButtons: [...document.querySelectorAll("[data-theme-toggle]")],
  apiKeyInput: document.querySelector("#apiKeyInput"),
  tokenInput: document.querySelector("#tokenInput"),
  fetchBoardsButton: document.querySelector("#fetchBoardsButton"),
  boardSelect: document.querySelector("#boardSelect"),
  refreshSelect: document.querySelector("#refreshSelect"),
  quickAddTemplateSelect: document.querySelector("#quickAddTemplateSelect"),
  refreshQuickAddOptionsButton: document.querySelector("#refreshQuickAddOptionsButton"),
  securityStatus: document.querySelector("#securityStatus"),
  topToggle: document.querySelector("#topToggle"),
  quickAddButton: document.querySelector("#quickAddButton"),
  refreshButton: document.querySelector("#refreshButton"),
  statusText: document.querySelector("#statusText"),
  boardName: document.querySelector("#boardName"),
  filterButtons: [...document.querySelectorAll(".filter-button")],
  focusPanel: document.querySelector("#focusPanel"),
  focusHeaderOpenButton: document.querySelector("#focusHeaderOpenButton"),
  focusEmpty: document.querySelector("#focusEmpty"),
  focusActive: document.querySelector("#focusActive"),
  nextSuggestion: document.querySelector("#nextSuggestion"),
  nextSuggestionTitle: document.querySelector("#nextSuggestionTitle"),
  nextSuggestionMeta: document.querySelector("#nextSuggestionMeta"),
  acceptNextButton: document.querySelector("#acceptNextButton"),
  dismissNextButton: document.querySelector("#dismissNextButton"),
  focusTitle: document.querySelector("#focusTitle"),
  focusMeta: document.querySelector("#focusMeta"),
  focusTimer: document.querySelector("#focusTimer"),
  focusTimeTotal: document.querySelector("#focusTimeTotal"),
  timerModeButtons: [...document.querySelectorAll("[data-timer-mode]")],
  pomodoroCustomInput: document.querySelector("#pomodoroCustomInput"),
  startTimerButton: document.querySelector("#startTimerButton"),
  stopTimerButton: document.querySelector("#stopTimerButton"),
  clearFocusButton: document.querySelector("#clearFocusButton"),
  completeFocusButton: document.querySelector("#completeFocusButton"),
  openFocusButton: document.querySelector("#openFocusButton"),
  focusNotesInput: document.querySelector("#focusNotesInput"),
  focusNotesCount: document.querySelector("#focusNotesCount"),
  focusNoteFormatButtons: [...document.querySelectorAll("[data-note-format]")],
  todayQueueCount: document.querySelector("#todayQueueCount"),
  todayQueueEmpty: document.querySelector("#todayQueueEmpty"),
  todayQueueList: document.querySelector("#todayQueueList"),
  weekQueueCount: document.querySelector("#weekQueueCount"),
  weekQueueEmpty: document.querySelector("#weekQueueEmpty"),
  weekQueueList: document.querySelector("#weekQueueList"),
  sidebarTodayCount: document.querySelector("#sidebarTodayCount"),
  sidebarWeekCount: document.querySelector("#sidebarWeekCount"),
  sidebarAllTasksCount: document.querySelector("#sidebarAllTasksCount"),
  sidebarListFilter: document.querySelector("#sidebarListFilter"),
  clearListFiltersButton: document.querySelector("#clearListFiltersButton"),
  dailySummaryTime: document.querySelector("#dailySummaryTime"),
  dailySummaryTasks: document.querySelector("#dailySummaryTasks"),
  dailySummaryTaskLabel: document.querySelector("#dailySummaryTaskLabel"),
  dailySummaryCompleted: document.querySelector("#dailySummaryCompleted"),
  dailySummaryCompletedLabel: document.querySelector("#dailySummaryCompletedLabel"),
  sidebarLinks: [...document.querySelectorAll(".sidebar-link")],
  workspaceTitle: document.querySelector("#workspaceTitle"),
  workspaceSubtitle: document.querySelector("#workspaceSubtitle"),
  taskCount: document.querySelector("#taskCount"),
  taskListTitle: document.querySelector("#taskListTitle"),
  emptyState: document.querySelector("#emptyState"),
  taskList: document.querySelector("#taskList"),
  quickAddDialog: document.querySelector("#quickAddDialog"),
  quickAddForm: document.querySelector("#quickAddForm"),
  quickAddTitleInput: document.querySelector("#quickAddTitleInput"),
  quickAddListSelect: document.querySelector("#quickAddListSelect"),
  quickAddLabelSelect: document.querySelector("#quickAddLabelSelect"),
  quickAddPrioritySelect: document.querySelector("#quickAddPrioritySelect"),
  quickAddDueDateInput: document.querySelector("#quickAddDueDateInput"),
  quickAddMemberSelect: document.querySelector("#quickAddMemberSelect"),
  quickAddCancelButton: document.querySelector("#quickAddCancelButton"),
  quickAddCreateButton: document.querySelector("#quickAddCreateButton"),
  quickAddRouteDialog: document.querySelector("#quickAddRouteDialog"),
  quickAddRouteTitle: document.querySelector("#quickAddRouteTitle"),
  quickAddRouteFocusButton: document.querySelector("#quickAddRouteFocusButton"),
  quickAddRouteTodayButton: document.querySelector("#quickAddRouteTodayButton"),
  quickAddRouteWeekButton: document.querySelector("#quickAddRouteWeekButton"),
  quickAddRouteAllButton: document.querySelector("#quickAddRouteAllButton")
};

async function init() {
  migrateLegacyLocalStorage();
  bindEvents();
  state.settings = await window.taskWidget.getSettings();
  syncSettingsUi();
  await syncUpdateStatus();

  if (!state.settings.hasCredentials || !state.settings.boardId) {
    if (state.settings.viewMode === "focus") {
      await setViewMode("planning", false);
    }
    showSetup(true);
    setStatus("Add Trello credentials and choose a board.");
    renderTasks();
    return;
  }

  await loadTasks();
  await loadQuickAddOptions();
  scheduleRefresh();
}

function migrateLegacyLocalStorage() {
  const storageMigrations = [
    [LEGACY_FOCUS_NOTES_STORAGE_KEY, FOCUS_NOTES_STORAGE_KEY],
    [LEGACY_FOCUS_SESSIONS_STORAGE_KEY, FOCUS_SESSIONS_STORAGE_KEY],
    [LEGACY_COMPLETED_TASKS_STORAGE_KEY, COMPLETED_TASKS_STORAGE_KEY]
  ];

  try {
    for (const [legacyKey, currentKey] of storageMigrations) {
      if (window.localStorage.getItem(currentKey) !== null) {
        continue;
      }

      const legacyValue = window.localStorage.getItem(legacyKey);
      if (legacyValue !== null) {
        window.localStorage.setItem(currentKey, legacyValue);
      }
    }
  } catch {
    // If localStorage is unavailable, continue with empty local planning history.
  }
}

function bindEvents() {
  elements.settingsButton.addEventListener("click", () => showSetup(!isSetupVisible()));
  elements.fetchBoardsButton.addEventListener("click", fetchBoards);
  elements.settingsForm.addEventListener("submit", saveSettings);
  elements.refreshQuickAddOptionsButton.addEventListener("click", () =>
    loadQuickAddOptions({ showStatus: true, boardId: elements.boardSelect.value })
  );
  elements.quickAddButton.addEventListener("click", openQuickAdd);
  elements.quickAddForm.addEventListener("submit", submitQuickAdd);
  elements.quickAddCancelButton.addEventListener("click", () => closeDialog(elements.quickAddDialog));
  elements.quickAddRouteFocusButton.addEventListener("click", () => routeQuickAddTask("focus"));
  elements.quickAddRouteTodayButton.addEventListener("click", () => routeQuickAddTask("today"));
  elements.quickAddRouteWeekButton.addEventListener("click", () => routeQuickAddTask("week"));
  elements.quickAddRouteAllButton.addEventListener("click", () => routeQuickAddTask("all"));
  elements.refreshButton.addEventListener("click", loadTasks);
  elements.updateButton.addEventListener("click", handleUpdateButtonClick);
  elements.topToggle.addEventListener("change", toggleAlwaysOnTop);
  elements.startTimerButton.addEventListener("click", startFocusTimer);
  elements.stopTimerButton.addEventListener("click", stopFocusTimerAndSave);
  elements.clearFocusButton.addEventListener("click", clearFocus);
  elements.completeFocusButton.addEventListener("click", () => completeTask(state.focusTask?.id));
  elements.openFocusButton.addEventListener("click", () => openTask(state.focusTask?.url));
  elements.focusHeaderOpenButton.addEventListener("click", () => openTask(state.focusTask?.url));
  for (const button of elements.timerModeButtons) {
    button.addEventListener("click", () => setTimerMode(button.dataset.timerMode));
  }
  elements.pomodoroCustomInput.addEventListener("change", handlePomodoroCustomChange);
  elements.focusNotesInput.addEventListener("input", handleFocusNotesInput);
  for (const button of elements.focusNoteFormatButtons) {
    button.addEventListener("click", () => applyNoteFormat(button.dataset.noteFormat));
  }
  elements.acceptNextButton.addEventListener("click", acceptNextSuggestion);
  elements.dismissNextButton.addEventListener("click", dismissNextSuggestion);
  elements.clearListFiltersButton.addEventListener("click", clearListFilters);

  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => setViewMode(button.dataset.viewMode));
  }

  for (const button of elements.themeButtons) {
    button.addEventListener("click", toggleTheme);
  }

  for (const button of elements.filterButtons) {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      state.workspaceView = "all";
      renderTasks();
    });
  }

  for (const link of elements.sidebarLinks) {
    link.addEventListener("click", () => handleSidebarLink(link));
  }

  window.taskWidget.onRefreshRequested(loadTasks);
  window.taskWidget.onOpenSettings(async () => {
    await setViewMode("planning", false);
    showSetup(true);
  });
  window.taskWidget.onViewModeChanged((settings) => {
    state.settings = {
      ...state.settings,
      ...settings
    };
    syncSettingsUi();
    renderTasks();
  });
  window.taskWidget.onThemeChanged((settings) => {
    state.settings = {
      ...state.settings,
      ...settings
    };
    syncSettingsUi();
  });

  window.taskWidget.onUpdateStatus((status) => {
    renderUpdateStatus(status, { showMessage: true });
  });
}

async function syncUpdateStatus() {
  if (!window.taskWidget?.getUpdateStatus) {
    return;
  }

  try {
    renderUpdateStatus(await window.taskWidget.getUpdateStatus());
  } catch {
    renderUpdateStatus({
      state: "unavailable",
      message: "Updates are unavailable in this build.",
      canCheck: false,
      canDownload: false,
      canInstall: false
    });
  }
}

function renderUpdateStatus(status, options = {}) {
  const normalizedStatus = normalizeUpdateStatus(status);
  state.updateStatus = normalizedStatus;

  if (!elements.updateButton) {
    return;
  }

  const isBusy = normalizedStatus.state === "checking" || normalizedStatus.state === "downloading";
  const isActionable =
    normalizedStatus.canCheck ||
    normalizedStatus.canDownload ||
    normalizedStatus.canInstall ||
    isBusy;

  elements.updateButton.classList.toggle("hidden", !isActionable);
  elements.updateButton.disabled = isBusy;
  elements.updateButton.textContent = getUpdateButtonLabel(normalizedStatus);
  elements.updateButton.title = normalizedStatus.message || "Check for updates";
  elements.updateButton.setAttribute("aria-label", elements.updateButton.title);

  if (options.showMessage && shouldShowUpdateStatusMessage(normalizedStatus)) {
    setStatus(normalizedStatus.message, normalizedStatus.state === "error");
  }
}

function normalizeUpdateStatus(status) {
  return {
    state: String(status?.state || "unavailable"),
    message: String(status?.message || ""),
    currentVersion: String(status?.currentVersion || ""),
    updateVersion: String(status?.updateVersion || ""),
    releaseDate: String(status?.releaseDate || ""),
    progress: status?.progress || null,
    canCheck: Boolean(status?.canCheck),
    canDownload: Boolean(status?.canDownload),
    canInstall: Boolean(status?.canInstall)
  };
}

function getUpdateButtonLabel(status) {
  if (status.canInstall) {
    return "Restart to Update";
  }

  if (status.canDownload) {
    return "Download Update";
  }

  if (status.state === "checking") {
    return "Checking...";
  }

  if (status.state === "downloading") {
    const percent = Math.max(0, Math.min(100, Number(status.progress?.percent || 0)));
    return `Downloading ${Math.round(percent)}%`;
  }

  return "Check for Updates";
}

function shouldShowUpdateStatusMessage(status) {
  return ["checking", "available", "not-available", "downloaded", "downloading", "error"].includes(
    status.state
  );
}

async function handleUpdateButtonClick() {
  const status = state.updateStatus || {};

  try {
    if (status.canInstall) {
      await window.taskWidget.installUpdate();
      return;
    }

    if (status.canDownload) {
      renderUpdateStatus(
        {
          ...status,
          state: "downloading",
          message: "Downloading update...",
          progress: {
            percent: 0
          },
          canCheck: false,
          canDownload: false
        },
        { showMessage: true }
      );
      await window.taskWidget.downloadUpdate();
      return;
    }

    renderUpdateStatus(
      {
        ...status,
        state: "checking",
        message: "Checking for updates...",
        canCheck: false,
        canDownload: false,
        canInstall: false
      },
      { showMessage: true }
    );
    await window.taskWidget.checkForUpdates();
  } catch (error) {
    setStatus(error.message, true);
    await syncUpdateStatus();
  }
}

function syncSettingsUi() {
  elements.topToggle.checked = Boolean(state.settings.alwaysOnTop);
  elements.refreshSelect.value = String(state.settings.refreshMinutes || 5);
  elements.boardName.textContent = state.settings.boardName || "";
  elements.securityStatus.textContent = state.settings.encryptionAvailable
    ? "Credentials will be encrypted on this computer."
    : "Credentials stay on this computer; OS encryption is unavailable.";
  applyViewModeClass(state.settings.viewMode);
  applyThemeClass(state.settings.theme);
  hydrateBoardSelect();
  hydrateQuickAddTemplateSelect();
  hydrateQuickAddListSelect();
  hydrateQuickAddLabelSelect();
  hydrateQuickAddPrioritySelect();
  hydrateQuickAddMemberSelect();
  publishFloatingTimerState();
}

function applyViewModeClass(viewMode) {
  const normalizedMode = viewMode === "focus" ? "focus" : "planning";
  const focusModeEnabled = normalizedMode === "focus";

  document.body.classList.toggle("focus-mode", focusModeEnabled);
  document.body.classList.toggle("planning-mode", !focusModeEnabled);

  elements.topModeButton.dataset.viewMode = focusModeEnabled ? "planning" : "focus";
  elements.topModeButton.textContent = "Focus Mode";
  elements.topModeButton.title = focusModeEnabled ? "Exit focus mode" : "Enter focus mode";
  elements.topModeButton.setAttribute("aria-label", elements.topModeButton.title);
  elements.topModeButton.setAttribute("aria-pressed", String(focusModeEnabled));

  for (const button of elements.modeButtons) {
    if (button === elements.topModeButton) {
      button.classList.toggle("active", focusModeEnabled);
    } else {
      button.classList.toggle("active", button.dataset.viewMode === normalizedMode);
    }
  }
}

async function setViewMode(viewMode, showStatus = true) {
  const nextViewMode = viewMode === "focus" ? "focus" : "planning";
  state.workspaceView = nextViewMode === "focus" ? "focus" : "dashboard";

  try {
    state.settings = await window.taskWidget.setViewMode(viewMode);
    syncSettingsUi();
    renderTasks();

    if (showStatus) {
      setStatus(`${state.settings.viewMode === "focus" ? "Focus" : "Plan"} mode.`);
    }

    return true;
  } catch (error) {
    setStatus(error.message, true);
    return false;
  }
}

function applyThemeClass(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";

  document.body.classList.toggle("theme-light", normalizedTheme === "light");
  document.body.classList.toggle("theme-dark", normalizedTheme === "dark");

  for (const button of elements.themeButtons) {
    const nextTheme = normalizedTheme === "light" ? "dark" : "light";
    button.title = `Switch to ${nextTheme} mode`;
    button.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  }
}

async function toggleTheme() {
  const nextTheme = state.settings?.theme === "light" ? "dark" : "light";

  try {
    state.settings = await window.taskWidget.setTheme(nextTheme);
    syncSettingsUi();
    setStatus(`${nextTheme === "light" ? "Light" : "Dark"} mode.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function showSetup(visible) {
  elements.setupPanel.classList.toggle("hidden", !visible);
}

function isSetupVisible() {
  return !elements.setupPanel.classList.contains("hidden");
}

async function fetchBoards() {
  const apiKey = elements.apiKeyInput.value.trim();
  const token = elements.tokenInput.value.trim();

  if (!apiKey || !token) {
    setStatus("Enter both a Trello API key and token.", true);
    return;
  }

  setLoading(true);
  setStatus("Fetching boards...");

  try {
    state.knownBoards = await window.taskWidget.getBoards({ apiKey, token });
    hydrateBoardSelect();
    setStatus(`Found ${state.knownBoards.length} boards.`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

function hydrateBoardSelect() {
  elements.boardSelect.innerHTML = "";

  const boards = [...state.knownBoards];
  if (state.settings?.boardId && !boards.some((board) => board.id === state.settings.boardId)) {
    boards.unshift({
      id: state.settings.boardId,
      name: state.settings.boardName || "Saved board"
    });
  }

  if (boards.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Fetch boards to choose one";
    elements.boardSelect.append(option);
    return;
  }

  for (const board of boards) {
    const option = document.createElement("option");
    option.value = board.id;
    option.textContent = board.name;
    option.selected = board.id === state.settings?.boardId;
    elements.boardSelect.append(option);
  }
}

async function loadQuickAddOptions({ showStatus = false, boardId } = {}) {
  const selectedBoardId = String(boardId || state.settings?.boardId || "").trim();
  const apiKey = elements.apiKeyInput.value.trim();
  const token = elements.tokenInput.value.trim();
  const credentials = apiKey && token ? { apiKey, token } : null;
  const hasLookupCredentials = Boolean(credentials || state.settings?.hasCredentials);

  if (!hasLookupCredentials || !selectedBoardId) {
    state.quickAddOptions = {
      lists: [],
      templates: [],
      labels: [],
      members: [],
      priorityField: null
    };
    state.quickAddOptionsBoardId = "";
    hydrateQuickAddTemplateSelect();
    hydrateQuickAddListSelect();
    hydrateQuickAddLabelSelect();
    hydrateQuickAddPrioritySelect();
    hydrateQuickAddMemberSelect();

    if (showStatus) {
      setStatus("Save Trello credentials and a board before loading Quick Add options.", true);
    }

    return false;
  }

  if (showStatus) {
    setLoading(true);
    setStatus("Refreshing Quick Add options...");
  }

  try {
    const options = await window.taskWidget.getQuickAddOptions({
      boardId: selectedBoardId,
      credentials
    });
    state.quickAddOptions = {
      lists: Array.isArray(options?.lists) ? options.lists : [],
      templates: Array.isArray(options?.templates) ? options.templates : [],
      labels: Array.isArray(options?.labels) ? options.labels : [],
      members: Array.isArray(options?.members) ? options.members : [],
      priorityField: options?.priorityField || null
    };
    state.quickAddOptionsBoardId = selectedBoardId;
    hydrateQuickAddTemplateSelect();
    hydrateQuickAddListSelect();
    hydrateQuickAddLabelSelect();
    hydrateQuickAddPrioritySelect();
    hydrateQuickAddMemberSelect();

    if (showStatus) {
      setStatus(
        `Found ${state.quickAddOptions.templates.length} templates, ${state.quickAddOptions.lists.length} lists, ${state.quickAddOptions.labels.length} labels, ${getQuickAddPriorityOptions().length} priorities, and ${state.quickAddOptions.members.length} members.`
      );
    }

    return true;
  } catch (error) {
    if (showStatus) {
      setStatus(error.message, true);
    }

    return false;
  } finally {
    if (showStatus) {
      setLoading(false);
    }
  }
}

function hydrateQuickAddTemplateSelect() {
  if (!elements.quickAddTemplateSelect) {
    return;
  }

  elements.quickAddTemplateSelect.innerHTML = "";

  const savedTemplate = state.settings?.quickAdd || {};
  const templates = [...(state.quickAddOptions.templates || [])];
  if (
    savedTemplate.templateCardId &&
    !templates.some((template) => template.id === savedTemplate.templateCardId)
  ) {
    templates.unshift({
      id: savedTemplate.templateCardId,
      name: savedTemplate.templateCardName || "Saved template"
    });
  }

  if (templates.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No template cards found";
    elements.quickAddTemplateSelect.append(option);
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a template";
  elements.quickAddTemplateSelect.append(placeholder);

  for (const template of templates) {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    option.selected = template.id === savedTemplate.templateCardId;
    elements.quickAddTemplateSelect.append(option);
  }
}

function hydrateQuickAddListSelect() {
  if (!elements.quickAddListSelect) {
    return;
  }

  elements.quickAddListSelect.innerHTML = "";

  if (state.quickAddOptions.lists.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No eligible lists";
    elements.quickAddListSelect.append(option);
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a list";
  elements.quickAddListSelect.append(placeholder);

  for (const list of state.quickAddOptions.lists) {
    const option = document.createElement("option");
    option.value = list.id;
    option.textContent = list.name;
    elements.quickAddListSelect.append(option);
  }
}

function hydrateQuickAddLabelSelect() {
  if (!elements.quickAddLabelSelect) {
    return;
  }

  elements.quickAddLabelSelect.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent =
    state.quickAddOptions.labels.length === 0 ? "No labels available" : "No label";
  elements.quickAddLabelSelect.append(emptyOption);

  for (const label of state.quickAddOptions.labels) {
    const option = document.createElement("option");
    option.value = label.id;
    option.textContent = label.name;
    elements.quickAddLabelSelect.append(option);
  }
}

function hydrateQuickAddPrioritySelect() {
  if (!elements.quickAddPrioritySelect) {
    return;
  }

  elements.quickAddPrioritySelect.innerHTML = "";

  const priorityOptions = getQuickAddPriorityOptions();
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent =
    priorityOptions.length === 0 ? "No Priority field options" : "No priority";
  elements.quickAddPrioritySelect.append(emptyOption);

  for (const priority of priorityOptions) {
    const option = document.createElement("option");
    option.value = priority.id;
    option.textContent = priority.name;
    elements.quickAddPrioritySelect.append(option);
  }
}

function getQuickAddPriorityOptions() {
  return Array.isArray(state.quickAddOptions.priorityField?.options)
    ? state.quickAddOptions.priorityField.options
    : [];
}

function hydrateQuickAddMemberSelect() {
  if (!elements.quickAddMemberSelect) {
    return;
  }

  elements.quickAddMemberSelect.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent =
    state.quickAddOptions.members.length === 0 ? "No members available" : "Unassigned";
  elements.quickAddMemberSelect.append(emptyOption);

  for (const member of state.quickAddOptions.members) {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = member.username ? `${member.name} (@${member.username})` : member.name;
    elements.quickAddMemberSelect.append(option);
  }
}

async function openQuickAdd() {
  if (state.settings?.viewMode === "focus") {
    await setViewMode("planning", false);
  }

  if (!state.settings?.hasCredentials || !state.settings?.boardId) {
    showSetup(true);
    setStatus("Finish Trello setup before using Quick Add.", true);
    return;
  }

  if (!state.settings?.quickAdd?.templateCardId) {
    showSetup(true);
    await loadQuickAddOptions();
    setStatus("Choose a Quick Add template in Settings.", true);
    return;
  }

  if (
    state.quickAddOptionsBoardId !== state.settings.boardId ||
    state.quickAddOptions.lists.length === 0
  ) {
    const loaded = await loadQuickAddOptions({
      showStatus: true,
      boardId: state.settings.boardId
    });
    if (!loaded) {
      return;
    }
  }

  if (state.quickAddOptions.lists.length === 0) {
    setStatus("No eligible Trello lists found for Quick Add.", true);
    return;
  }

  hydrateQuickAddListSelect();
  hydrateQuickAddLabelSelect();
  hydrateQuickAddPrioritySelect();
  hydrateQuickAddMemberSelect();
  elements.quickAddTitleInput.value = "";
  elements.quickAddListSelect.value = "";
  elements.quickAddLabelSelect.value = "";
  elements.quickAddPrioritySelect.value = "";
  elements.quickAddDueDateInput.value = "";
  elements.quickAddMemberSelect.value = "";
  showDialog(elements.quickAddDialog);
  elements.quickAddTitleInput.focus();
}

async function submitQuickAdd(event) {
  event.preventDefault();

  const name = elements.quickAddTitleInput.value.trim();
  const listId = elements.quickAddListSelect.value;
  const labelId = elements.quickAddLabelSelect.value;
  const priorityOptionId = elements.quickAddPrioritySelect.value;
  const dueDate = elements.quickAddDueDateInput.value;
  const memberId = elements.quickAddMemberSelect.value;

  if (!name) {
    setStatus("Enter a task title.", true);
    elements.quickAddTitleInput.focus();
    return;
  }

  if (!listId) {
    setStatus("Choose a destination list.", true);
    elements.quickAddListSelect.focus();
    return;
  }

  setLoading(true);
  elements.quickAddCreateButton.disabled = true;
  setStatus("Creating task...");

  try {
    const createdCard = await window.taskWidget.quickAddCard({
      name,
      listId,
      labelId,
      priorityOptionId,
      dueDate,
      memberId
    });

    closeDialog(elements.quickAddDialog);
    await loadTasks();

    let createdTask = getTaskById(createdCard.id);
    if (!createdTask) {
      createdTask = buildQuickAddTask(createdCard, {
        listId,
        labelId,
        dueDate
      });
      state.tasks = [createdTask, ...state.tasks];
      renderTasks();
    }

    state.pendingQuickAddTask = createdTask;
    showQuickAddRoutePrompt(createdTask);
    setStatus("Created task. Choose where to place it.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    elements.quickAddCreateButton.disabled = false;
    setLoading(false);
  }
}

function buildQuickAddTask(card, options) {
  const listId = options.listId;
  const destinationList = state.quickAddOptions.lists.find((list) => list.id === listId);
  const selectedLabel = state.quickAddOptions.labels.find((label) => label.id === options.labelId);
  const due = card.due || normalizeQuickAddFallbackDue(options.dueDate);

  return {
    id: card.id,
    name: card.name,
    description: "",
    due,
    dueComplete: false,
    lastActivity: new Date().toISOString(),
    url: card.url,
    listId,
    listName: destinationList?.name || "Unknown list",
    labels: Array.isArray(card.labels) && card.labels.length > 0
      ? card.labels
      : selectedLabel
        ? [selectedLabel]
        : [],
    timeSpentMins: null,
    status: card.status || getQuickAddFallbackDueStatus(due)
  };
}

function normalizeQuickAddFallbackDue(dueDate) {
  if (!dueDate) {
    return null;
  }

  const due = new Date(`${dueDate}T12:00:00`);
  return Number.isNaN(due.getTime()) ? null : due.toISOString();
}

function getQuickAddFallbackDueStatus(due) {
  if (!due) {
    return "none";
  }

  const now = new Date();
  const dueDate = new Date(due);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  if (dueDate < now) {
    return "overdue";
  }

  if (dueDate < tomorrowStart) {
    return "today";
  }

  return "upcoming";
}

function showQuickAddRoutePrompt(task) {
  elements.quickAddRouteTitle.textContent = task.name;
  elements.quickAddRouteFocusButton.disabled = state.timer.isRunning || state.timer.elapsedMs > 0;
  showDialog(elements.quickAddRouteDialog);
}

async function routeQuickAddTask(route) {
  const task = state.pendingQuickAddTask;
  if (!task) {
    closeDialog(elements.quickAddRouteDialog);
    return;
  }

  if (route === "all") {
    state.pendingQuickAddTask = null;
    closeDialog(elements.quickAddRouteDialog);
    renderTasks();
    setStatus("Created in All Tasks.");
    return;
  }

  if (route === "focus") {
    if (state.timer.isRunning || state.timer.elapsedMs > 0) {
      setStatus("Save the current timer before changing focus.", true);
      showQuickAddRoutePrompt(task);
      return;
    }

    await setFocusTask(task);
    if (state.focusTask?.id === task.id) {
      state.pendingQuickAddTask = null;
      closeDialog(elements.quickAddRouteDialog);
    }
    return;
  }

  const queueName = route === "week" ? "week" : "today";

  try {
    state.settings = await window.taskWidget.addToQueue(queueName, task.id);
    state.pendingQuickAddTask = null;
    closeDialog(elements.quickAddRouteDialog);
    renderTasks();
    setStatus(`Added to ${getQueueLabel(queueName)}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function showDialog(dialog) {
  if (dialog.open) {
    return;
  }

  dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) {
    dialog.close();
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const apiKey = elements.apiKeyInput.value.trim();
  const token = elements.tokenInput.value.trim();
  const selectedOption = elements.boardSelect.selectedOptions[0];
  const boardId = elements.boardSelect.value;
  const boardChanged = boardId !== state.settings?.boardId;
  const selectedTemplateOption = elements.quickAddTemplateSelect.selectedOptions[0];
  const templateMatchesBoard = !boardChanged || state.quickAddOptionsBoardId === boardId;
  const quickAddTemplateCardId = templateMatchesBoard ? elements.quickAddTemplateSelect.value : "";

  if (!state.settings.hasCredentials && (!apiKey || !token)) {
    setStatus("Enter Trello credentials before saving.", true);
    return;
  }

  if (!boardId) {
    setStatus("Fetch boards and choose one before saving.", true);
    return;
  }

  setLoading(true);
  setStatus("Saving settings...");

  try {
    if (apiKey || token) {
      await window.taskWidget.saveCredentials({ apiKey, token });
      elements.apiKeyInput.value = "";
      elements.tokenInput.value = "";
    }

    state.settings = await window.taskWidget.saveSettings({
      boardId,
      boardName: selectedOption?.textContent || "",
      refreshMinutes: Number(elements.refreshSelect.value),
      quickAdd: {
        templateCardId: quickAddTemplateCardId,
        templateCardName: quickAddTemplateCardId ? selectedTemplateOption?.textContent || "" : ""
      }
    });

    syncSettingsUi();
    showSetup(false);
    scheduleRefresh();
    await loadTasks();
    await loadQuickAddOptions({ boardId });
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

async function toggleAlwaysOnTop() {
  try {
    state.settings = await window.taskWidget.setAlwaysOnTop(elements.topToggle.checked);
    syncSettingsUi();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadTasks() {
  if (!state.settings?.hasCredentials || !state.settings?.boardId) {
    showSetup(true);
    renderTasks();
    return;
  }

  setLoading(true);
  setStatus("Refreshing tasks...");

  try {
    state.tasks = await window.taskWidget.getCards();
    state.settings = await window.taskWidget.pruneQueues(state.tasks.map((task) => task.id));
    syncSettingsUi();
    renderTasks();
    setStatus(`Updated ${formatTime(new Date())}.`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

function scheduleRefresh() {
  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
  }

  const minutes = Number(state.settings?.refreshMinutes || 5);
  state.refreshTimer = window.setInterval(loadTasks, Math.max(minutes, 1) * 60 * 1000);
}

function renderTasks() {
  applyWorkspaceViewClass();
  reconcileSelectedListFilters();

  for (const button of elements.filterButtons) {
    button.classList.toggle("active", button.dataset.filter === state.activeFilter);
  }

  reconcileFocusWithTasks();
  const tasks = getFilteredTasks();

  renderFocus(state.focusTask);
  renderQueues();
  renderTaskList(tasks);
  renderSidebar();
  renderWorkspaceHeader();

  elements.taskCount.textContent = String(tasks.length);
  elements.taskListTitle.textContent = getTaskListTitle();
  elements.emptyState.classList.toggle("hidden", tasks.length > 0);
  elements.boardName.textContent = state.settings?.boardName || "";
}

function renderWorkspaceHeader() {
  const copy = {
    dashboard: {
      title: "Home",
      subtitle: "Your daily console for planning, focus, and work clarity."
    },
    today: {
      title: "Today",
      subtitle: "Keep the day small enough to actually finish."
    },
    week: {
      title: "This Week",
      subtitle: "Shape the work before it becomes noise."
    },
    all: {
      title: "All Tasks",
      subtitle: "Review available Trello cards and pull the right ones forward."
    },
    focus: {
      title: "Focus",
      subtitle: "Stay with the active task."
    }
  };
  const current = copy[state.workspaceView] || copy.dashboard;

  elements.workspaceTitle.textContent = current.title;
  elements.workspaceSubtitle.textContent = current.subtitle;
}

function applyWorkspaceViewClass() {
  document.body.dataset.workspaceView = state.workspaceView;
}

function reconcileSelectedListFilters() {
  if (state.selectedListIds.size === 0) {
    return;
  }

  const activeListIds = new Set(state.tasks.map((task) => task.listId).filter(Boolean));

  for (const listId of [...state.selectedListIds]) {
    if (!activeListIds.has(listId)) {
      state.selectedListIds.delete(listId);
    }
  }
}

async function handleSidebarLink(link) {
  const workspaceView = link.dataset.workspace;

  if (!workspaceView) {
    return;
  }

  if (link.dataset.filter) {
    state.activeFilter = link.dataset.filter;
  }

  if (workspaceView === "focus") {
    await setViewMode("focus");
    return;
  }

  state.workspaceView = workspaceView;

  if (state.settings?.viewMode === "focus") {
    try {
      state.settings = await window.taskWidget.setViewMode("planning");
      syncSettingsUi();
    } catch (error) {
      setStatus(error.message, true);
      return;
    }
  }

  renderTasks();
  setStatus(`${getWorkspaceViewLabel(workspaceView)} view.`);
}

function reconcileFocusWithTasks() {
  if (!state.focusTask) {
    reconcileNextSuggestionWithTasks();
    return;
  }

  const freshTask = state.tasks.find((task) => task.id === state.focusTask.id);
  if (freshTask) {
    state.focusTask = freshTask;
    reconcileNextSuggestionWithTasks();
    return;
  }

  if (!state.timer.isRunning) {
    state.focusTask = null;
  }

  reconcileNextSuggestionWithTasks();
}

function reconcileNextSuggestionWithTasks() {
  if (!state.nextSuggestion) {
    return;
  }

  state.nextSuggestion = state.tasks.find((task) => task.id === state.nextSuggestion.id) || null;
}

function getQueueIds(queueName) {
  return state.settings?.queues?.[queueName] || [];
}

function isQueued(queueName, cardId) {
  return getQueueIds(queueName).includes(cardId);
}

function getTaskById(cardId) {
  return state.tasks.find((task) => task.id === cardId) || null;
}

function getQueuedTasks(queueName) {
  return getQueueIds(queueName).map(getTaskById).filter(Boolean);
}

function getVisibleQueuedTasks(queueName) {
  return applySelectedListFilter(getQueuedTasks(queueName));
}

function renderQueues() {
  renderQueue("today", elements.todayQueueList, elements.todayQueueEmpty, elements.todayQueueCount);
  renderQueue("week", elements.weekQueueList, elements.weekQueueEmpty, elements.weekQueueCount);
}

function renderQueue(queueName, listElement, emptyElement, countElement) {
  const tasks = getVisibleQueuedTasks(queueName);
  listElement.innerHTML = "";
  listElement.ondragover = (event) => handleQueueListDragOver(event, queueName, listElement);
  listElement.ondragleave = (event) => handleQueueListDragLeave(event, listElement);
  listElement.ondrop = (event) => handleQueueListDrop(event, queueName, listElement);
  emptyElement.classList.toggle("hidden", tasks.length > 0);
  countElement.textContent = String(tasks.length);

  for (const task of tasks) {
    listElement.append(renderQueueCard(queueName, task));
  }
}

function renderQueueCard(queueName, task) {
  const item = document.createElement("article");
  item.className = "task-item queue-card";
  item.draggable = true;
  item.classList.toggle("active-focus", task.id === state.focusTask?.id);
  item.addEventListener("dragstart", (event) =>
    handleQueueDragStart(event, queueName, task.id, item)
  );
  item.addEventListener("dragover", (event) =>
    handleQueueDragOver(event, queueName, task.id, item)
  );
  item.addEventListener("dragleave", () => clearQueueDropClasses(item));
  item.addEventListener("drop", (event) => handleQueueDrop(event, queueName, task.id, item));
  item.addEventListener("dragend", clearQueueDragState);

  const completeCheckbox = createCompleteCheckbox(task, item);
  const title = document.createElement("h3");
  title.textContent = task.name;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  renderMeta(meta, task);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.addEventListener("mousedown", (event) => event.stopPropagation());

  const focusButton = createActionButton(
    task.id === state.focusTask?.id ? "Focused" : "Focus",
    "secondary-button",
    () => setFocusTask(task)
  );
  focusButton.disabled = state.timer.isRunning || state.timer.elapsedMs > 0;

  const openButton = createActionButton("Open", "secondary-button", () => openTask(task.url));
  const removeButton = createActionButton("Remove", "secondary-button", () =>
    removeQueuedTask(queueName, task.id)
  );
  const queueButtons =
    queueName === "week"
      ? [
          createActionButton("Move to Today", "secondary-button", () =>
            moveQueuedTaskToToday(task.id)
          )
        ]
      : [];

  actions.append(...queueButtons, focusButton, openButton, removeButton);
  item.append(completeCheckbox, title, meta, actions);
  return item;
}

function handleQueueDragStart(event, queueName, cardId, item) {
  if (event.target instanceof Element && event.target.closest("button")) {
    event.preventDefault();
    return;
  }

  state.queueDrag = { queueName, cardId };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", cardId);
  window.requestAnimationFrame(() => item.classList.add("dragging"));
}

function handleQueueDragOver(event, queueName, targetCardId, item) {
  if (!canDropQueuedTask(queueName, targetCardId)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = "move";
  const placement = getQueueDropPlacement(event, item);
  item.classList.toggle("drag-over-before", placement === "before");
  item.classList.toggle("drag-over-after", placement === "after");
}

function handleQueueDrop(event, queueName, targetCardId, item) {
  if (!canDropQueuedTask(queueName, targetCardId)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const placement = getQueueDropPlacement(event, item);
  clearQueueDropClasses(item);
  reorderQueuedTask(queueName, state.queueDrag.cardId, targetCardId, placement);
}

function handleQueueListDragOver(event, queueName, listElement) {
  if (!canDropQueuedTask(queueName)) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  listElement.classList.add("drag-ready");
}

function handleQueueListDragLeave(event, listElement) {
  if (!listElement.contains(event.relatedTarget)) {
    listElement.classList.remove("drag-ready");
  }
}

function handleQueueListDrop(event, queueName, listElement) {
  if (!canDropQueuedTask(queueName)) {
    return;
  }

  if (event.target instanceof Element && event.target.closest(".queue-card")) {
    return;
  }

  event.preventDefault();
  listElement.classList.remove("drag-ready");
  reorderQueuedTask(queueName, state.queueDrag.cardId);
}

function canDropQueuedTask(queueName, targetCardId = null) {
  return Boolean(
    state.queueDrag.cardId &&
      state.queueDrag.queueName === queueName &&
      state.queueDrag.cardId !== targetCardId
  );
}

function getQueueDropPlacement(event, item) {
  const rect = item.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
}

function clearQueueDropClasses(item) {
  item.classList.remove("drag-over-before", "drag-over-after");
}

function clearQueueDragState() {
  state.queueDrag = {
    queueName: null,
    cardId: null
  };

  for (const element of document.querySelectorAll(
    ".queue-card.dragging, .queue-card.drag-over-before, .queue-card.drag-over-after"
  )) {
    element.classList.remove("dragging", "drag-over-before", "drag-over-after");
  }

  for (const element of document.querySelectorAll(".queue-list.drag-ready")) {
    element.classList.remove("drag-ready");
  }
}

async function reorderQueuedTask(queueName, draggedCardId, targetCardId = null, placement = "after") {
  const currentIds = getQueueIds(queueName);

  if (!currentIds.includes(draggedCardId)) {
    return;
  }

  const nextIds = currentIds.filter((id) => id !== draggedCardId);
  let insertAt = nextIds.length;

  if (targetCardId) {
    const targetIndex = nextIds.indexOf(targetCardId);
    if (targetIndex === -1) {
      return;
    }

    insertAt = placement === "after" ? targetIndex + 1 : targetIndex;
  }

  nextIds.splice(insertAt, 0, draggedCardId);

  if (currentIds.length === nextIds.length && currentIds.every((id, index) => id === nextIds[index])) {
    return;
  }

  try {
    state.settings = await window.taskWidget.reorderQueue(queueName, nextIds);
    renderTasks();
    setStatus(`${getQueueLabel(queueName)} reordered.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function getQueueLabel(queueName) {
  return queueName === "today" ? "Today Queue" : "This Week Queue";
}

function renderSidebar() {
  const todayCount = getVisibleQueuedTasks("today").length;
  const weekCount = getVisibleQueuedTasks("week").length;
  const allTasksCount = getVisibleAvailableTasks().length;

  elements.sidebarTodayCount.textContent = String(todayCount);
  elements.sidebarWeekCount.textContent = String(weekCount);
  elements.sidebarAllTasksCount.textContent = String(allTasksCount);

  for (const link of elements.sidebarLinks) {
    link.classList.toggle("active", link.dataset.workspace === state.workspaceView);
  }

  renderListFilters();
  renderDailyTimeSummary();
}

function renderDailyTimeSummary() {
  if (!elements.dailySummaryTime || !elements.dailySummaryTasks || !elements.dailySummaryCompleted) {
    return;
  }

  const summary = getTodayFocusSummary();
  elements.dailySummaryTime.textContent = formatSummaryDuration(summary.totalMinutes);
  elements.dailySummaryTasks.textContent = String(summary.distinctTaskCount);
  elements.dailySummaryCompleted.textContent = String(summary.completedTaskCount);

  if (elements.dailySummaryTaskLabel) {
    elements.dailySummaryTaskLabel.textContent =
      summary.distinctTaskCount === 1 ? "task worked" : "tasks worked";
  }

  if (elements.dailySummaryCompletedLabel) {
    elements.dailySummaryCompletedLabel.textContent =
      summary.completedTaskCount === 1 ? "task completed" : "tasks completed";
  }
}

function getWorkspaceViewLabel(workspaceView) {
  if (workspaceView === "today") {
    return "Today";
  }

  if (workspaceView === "week") {
    return "This Week";
  }

  if (workspaceView === "all") {
    return "All Tasks";
  }

  if (workspaceView === "dashboard") {
    return "Home";
  }

  return "Focus";
}

function renderListFilters() {
  elements.sidebarListFilter.innerHTML = "";
  elements.clearListFiltersButton.classList.toggle("hidden", state.selectedListIds.size === 0);

  const lists = getSidebarLists();
  for (const [index, list] of lists.entries()) {
    const item = document.createElement("button");
    item.className = `list-filter-item list-color-${(index % 5) + 1}`;
    item.type = "button";
    item.setAttribute("aria-pressed", String(state.selectedListIds.has(list.id)));
    item.classList.toggle("active", state.selectedListIds.has(list.id));
    item.addEventListener("click", () => toggleListFilter(list.id, list.name));

    const name = document.createElement("span");
    name.className = "list-filter-name";
    name.textContent = list.name;

    const count = document.createElement("span");
    count.className = "list-filter-count";
    count.textContent = String(list.count);

    item.append(name, count);
    elements.sidebarListFilter.append(item);
  }

  if (lists.length === 0) {
    const empty = document.createElement("div");
    empty.className = "list-filter-empty";
    empty.textContent = "No lists yet";
    elements.sidebarListFilter.append(empty);
  }
}

function getSidebarLists() {
  const listsById = new Map();

  for (const task of state.tasks) {
    if (!task.listId || !task.listName) {
      continue;
    }

    const current = listsById.get(task.listId);
    if (current) {
      current.count += 1;
    } else {
      listsById.set(task.listId, {
        id: task.listId,
        name: task.listName,
        count: 1
      });
    }
  }

  return [...listsById.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function toggleListFilter(listId, listName) {
  if (state.selectedListIds.has(listId)) {
    state.selectedListIds.delete(listId);
  } else {
    state.selectedListIds.add(listId);
  }

  renderTasks();
  setStatus(
    state.selectedListIds.has(listId)
      ? `Filtering to ${listName}.`
      : `${listName} filter removed.`
  );
}

function clearListFilters() {
  if (state.selectedListIds.size === 0) {
    return;
  }

  state.selectedListIds.clear();
  renderTasks();
  setStatus("Showing all lists.");
}

function getTaskListTitle() {
  if (state.activeFilter === "due-soon") {
    return "Due Soon";
  }

  if (state.activeFilter === "overdue") {
    return "Overdue";
  }

  if (state.activeFilter === "none") {
    return "No Due Date";
  }

  return "All Tasks";
}

function createActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createCompleteCheckbox(task, item) {
  const checkbox = document.createElement("button");
  checkbox.className = "complete-checkbox";
  checkbox.type = "button";
  checkbox.setAttribute("role", "checkbox");
  checkbox.setAttribute("aria-checked", "false");
  checkbox.setAttribute("aria-label", `Complete ${task.name}`);
  checkbox.title = "Complete task";
  checkbox.addEventListener("click", (event) => handlePlanTaskComplete(event, task, item, checkbox));
  return checkbox;
}

async function handlePlanTaskComplete(event, task, item, checkbox) {
  event.preventDefault();
  event.stopPropagation();

  if (checkbox.disabled) {
    return;
  }

  if (task.id === state.focusTask?.id && (state.timer.isRunning || state.timer.elapsedMs > 0)) {
    setStatus("Save the current timer before completing this task.", true);
    return;
  }

  checkbox.disabled = true;
  checkbox.setAttribute("aria-checked", "true");
  item.classList.add("completing");

  await waitForCompletionAnimation();
  const completed = await completeTask(task.id);

  if (!completed) {
    checkbox.disabled = false;
    checkbox.setAttribute("aria-checked", "false");
    item.classList.remove("completing");
  }
}

function waitForCompletionAnimation() {
  return new Promise((resolve) => window.setTimeout(resolve, 420));
}

async function toggleQueuedTask(queueName, cardId) {
  const queueLabel = queueName === "today" ? "Today Queue" : "This Week Queue";

  try {
    state.settings = isQueued(queueName, cardId)
      ? await window.taskWidget.removeFromQueue(queueName, cardId)
      : await window.taskWidget.addToQueue(queueName, cardId);
    renderTasks();
    setStatus(`${isQueued(queueName, cardId) ? "Added to" : "Removed from"} ${queueLabel}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function removeQueuedTask(queueName, cardId) {
  try {
    state.settings = await window.taskWidget.removeFromQueue(queueName, cardId);
    renderTasks();
    setStatus(`Removed from ${getQueueLabel(queueName)}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function moveQueuedTaskToToday(cardId) {
  try {
    state.settings = await window.taskWidget.moveBetweenQueues("week", "today", cardId);
    renderTasks();
    setStatus("Moved to Today Queue.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function setNextSuggestionFromToday(excludedCardId) {
  const nextTask =
    getQueuedTasks("today").find((task) => task.id !== excludedCardId && task.id !== state.focusTask?.id) ||
    null;

  state.nextSuggestion = nextTask;
}

async function acceptNextSuggestion() {
  if (!state.nextSuggestion) {
    return;
  }

  await setFocusTask(state.nextSuggestion);
}

function dismissNextSuggestion() {
  state.nextSuggestion = null;
  renderFocus(state.focusTask);
  setStatus("Next task dismissed.");
}

async function setFocusTask(task) {
  if (state.timer.isRunning || state.timer.elapsedMs > 0) {
    setStatus("Save the current timer before changing focus.", true);
    return;
  }

  if (state.focusTask?.id && state.focusTask.id !== task.id) {
    setLoading(true);
    setStatus("Ending previous focus...");

    try {
      await syncFocusNoteToTrello(state.focusTask);
    } catch (error) {
      setStatus(error.message, true);
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  state.focusTask = task;
  state.nextSuggestion = null;
  resetTimer();
  renderTasks();
  setStatus(`Focused: ${task.name}`);
}

async function clearFocus() {
  if (state.timer.isRunning || state.timer.elapsedMs > 0) {
    setStatus("Save the current timer before clearing focus.", true);
    return;
  }

  if (!state.focusTask) {
    return;
  }

  const focusTask = state.focusTask;
  setLoading(true);
  setStatus("Clearing focus...");

  try {
    await syncFocusNoteToTrello(focusTask);
  } catch (error) {
    setStatus(error.message, true);
    setLoading(false);
    return;
  }

  const clearedTaskId = state.focusTask?.id;
  state.focusTask = null;
  resetTimer();
  setNextSuggestionFromToday(clearedTaskId);
  renderTasks();
  setStatus("Focus cleared.");
  setLoading(false);
}

async function startFocusTimer() {
  if (!state.focusTask || state.timer.isRunning) {
    return;
  }

  const durationMs = getTimerDurationMs();
  if (durationMs && getTimerElapsedMs() >= durationMs) {
    setStatus("Save elapsed Pomodoro time before starting another session.", true);
    return;
  }

  if (state.settings?.viewMode !== "focus") {
    const enteredFocusMode = await setViewMode("focus", false);
    if (!enteredFocusMode) {
      return;
    }
  }

  state.timer.isRunning = true;
  state.timer.startedAt = Date.now();
  state.timer.completed = false;
  state.timer.intervalId = window.setInterval(updateTimerDisplay, 1000);
  renderFocus(state.focusTask);
  setStatus(durationMs ? "Pomodoro running." : "Timer running.");
}

async function stopFocusTimerAndSave() {
  if (!state.focusTask) {
    return;
  }

  const elapsedMs = getTimerElapsedMs();

  if (state.timer.isRunning) {
    window.clearInterval(state.timer.intervalId);
    state.timer.isRunning = false;
    state.timer.startedAt = null;
    state.timer.intervalId = null;
    state.timer.elapsedMs = elapsedMs;
  }

  if (elapsedMs <= 0) {
    renderFocus(state.focusTask);
    return;
  }

  const minutes = Math.max(1, Math.ceil(elapsedMs / 60000));
  setLoading(true);
  setStatus(`Saving ${minutes} mins to Trello...`);

  try {
    const result = await window.taskWidget.addTimeSpent(state.focusTask.id, minutes);
    applyTimeSpentUpdate(result.cardId, result.totalMinutes);
    recordFocusSession(state.focusTask, result.minutesAdded);
    resetTimer();
    renderTasks();
    setStatus(`Added ${result.minutesAdded} mins to Trello.`);
  } catch (error) {
    state.timer.elapsedMs = elapsedMs;
    renderFocus(state.focusTask);
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

function applyTimeSpentUpdate(cardId, totalMinutes) {
  state.tasks = state.tasks.map((task) =>
    task.id === cardId ? { ...task, timeSpentMins: totalMinutes } : task
  );

  if (state.focusTask?.id === cardId) {
    state.focusTask = {
      ...state.focusTask,
      timeSpentMins: totalMinutes
    };
  }
}

function recordFocusSession(task, minutes) {
  const minutesWorked = Number(minutes);
  if (!task?.id || !Number.isFinite(minutesWorked) || minutesWorked <= 0) {
    return;
  }

  const savedAt = new Date();
  const sessions = loadFocusSessions();
  sessions.push({
    cardId: task.id,
    taskName: task.name || "Untitled task",
    minutes: Math.max(1, Math.round(minutesWorked)),
    savedAt: savedAt.toISOString(),
    dayKey: getLocalDayKey(savedAt)
  });

  saveFocusSessions(sessions.slice(-MAX_STORED_FOCUS_SESSIONS));
}

function getTodayFocusSummary() {
  const todayKey = getLocalDayKey(new Date());
  const distinctTaskIds = new Set();
  let totalMinutes = 0;

  for (const session of loadFocusSessions()) {
    if (getFocusSessionDayKey(session) !== todayKey) {
      continue;
    }

    totalMinutes += session.minutes;
    distinctTaskIds.add(session.cardId);
  }

  const activeSession = getActiveFocusSessionSummary(todayKey);
  if (activeSession.minutes > 0) {
    totalMinutes += activeSession.minutes;
    distinctTaskIds.add(activeSession.cardId);
  }

  return {
    totalMinutes,
    distinctTaskCount: distinctTaskIds.size,
    completedTaskCount: getCompletedTaskCountForDay(todayKey)
  };
}

function getActiveFocusSessionSummary(todayKey) {
  if (!state.timer.isRunning || !state.focusTask?.id) {
    return {
      cardId: null,
      minutes: 0
    };
  }

  const startedAt = new Date(state.timer.startedAt);
  const todayStart = getLocalDayStart(new Date());
  const elapsedMs = getTimerElapsedMs();
  const activeTodayMs =
    getLocalDayKey(startedAt) === todayKey ? elapsedMs : Date.now() - todayStart.getTime();

  if (activeTodayMs <= 0) {
    return {
      cardId: null,
      minutes: 0
    };
  }

  return {
    cardId: state.focusTask.id,
    minutes: Math.max(1, Math.ceil(activeTodayMs / 60000))
  };
}

function loadFocusSessions() {
  try {
    const sessions = JSON.parse(window.localStorage.getItem(FOCUS_SESSIONS_STORAGE_KEY) || "[]");
    if (!Array.isArray(sessions)) {
      return [];
    }

    return sessions
      .map(normalizeFocusSession)
      .filter(Boolean)
      .slice(-MAX_STORED_FOCUS_SESSIONS);
  } catch {
    return [];
  }
}

function normalizeFocusSession(session) {
  if (!session || typeof session !== "object") {
    return null;
  }

  const cardId = String(session.cardId || "").trim();
  const minutes = Math.max(0, Math.round(Number(session.minutes)));
  const savedAt = String(session.savedAt || "").trim();

  if (!cardId || !minutes || !savedAt) {
    return null;
  }

  return {
    cardId,
    taskName: String(session.taskName || "Untitled task"),
    minutes,
    savedAt,
    dayKey: String(session.dayKey || "")
  };
}

function saveFocusSessions(sessions) {
  try {
    window.localStorage.setItem(FOCUS_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    setStatus("Could not save the daily time summary locally.", true);
  }
}

function recordCompletedTask(task) {
  const cardId = String(task?.id || "").trim();
  if (!cardId) {
    return;
  }

  const completedAt = new Date();
  const completedTasks = loadCompletedTasks();
  completedTasks.push({
    cardId,
    taskName: task?.name || "Untitled task",
    completedAt: completedAt.toISOString(),
    dayKey: getLocalDayKey(completedAt)
  });

  saveCompletedTasks(completedTasks.slice(-MAX_STORED_COMPLETED_TASKS));
}

function getCompletedTaskCountForDay(dayKey) {
  return loadCompletedTasks().filter((task) => getCompletedTaskDayKey(task) === dayKey).length;
}

function loadCompletedTasks() {
  try {
    const completedTasks = JSON.parse(window.localStorage.getItem(COMPLETED_TASKS_STORAGE_KEY) || "[]");
    if (!Array.isArray(completedTasks)) {
      return [];
    }

    return completedTasks
      .map(normalizeCompletedTask)
      .filter(Boolean)
      .slice(-MAX_STORED_COMPLETED_TASKS);
  } catch {
    return [];
  }
}

function normalizeCompletedTask(task) {
  if (!task || typeof task !== "object") {
    return null;
  }

  const cardId = String(task.cardId || "").trim();
  const completedAt = String(task.completedAt || "").trim();

  if (!cardId || !completedAt) {
    return null;
  }

  return {
    cardId,
    taskName: String(task.taskName || "Untitled task"),
    completedAt,
    dayKey: String(task.dayKey || "")
  };
}

function saveCompletedTasks(completedTasks) {
  try {
    window.localStorage.setItem(COMPLETED_TASKS_STORAGE_KEY, JSON.stringify(completedTasks));
  } catch {
    setStatus("Could not save completed task history locally.", true);
  }
}

function getCompletedTaskDayKey(task) {
  if (task.dayKey) {
    return task.dayKey;
  }

  return getLocalDayKey(new Date(task.completedAt));
}

function getFocusSessionDayKey(session) {
  if (session.dayKey) {
    return session.dayKey;
  }

  return getLocalDayKey(new Date(session.savedAt));
}

function getLocalDayKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalDayStart(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function resetTimer() {
  if (state.timer.intervalId) {
    window.clearInterval(state.timer.intervalId);
  }

  const mode = normalizeTimerMode(state.timer.mode);
  const customMinutes = normalizeCustomPomodoroMinutes(state.timer.customMinutes);

  state.timer = {
    isRunning: false,
    startedAt: null,
    elapsedMs: 0,
    intervalId: null,
    mode,
    customMinutes,
    completed: false
  };
  updateTimerDisplay();
}

function getTimerElapsedMs() {
  let elapsedMs = state.timer.elapsedMs;

  if (!state.timer.isRunning) {
    return getCappedTimerElapsedMs(elapsedMs);
  }

  elapsedMs += Date.now() - state.timer.startedAt;
  return getCappedTimerElapsedMs(elapsedMs);
}

function getCappedTimerElapsedMs(elapsedMs) {
  const durationMs = getTimerDurationMs();
  if (!durationMs) {
    return Math.max(0, elapsedMs);
  }

  return Math.min(Math.max(0, elapsedMs), durationMs);
}

function getTimerDurationMs() {
  const durationMinutes = getTimerDurationMinutes();
  return durationMinutes ? durationMinutes * 60000 : null;
}

function getTimerDurationMinutes() {
  const mode = normalizeTimerMode(state.timer.mode);
  if (mode === "pomodoro-custom") {
    return normalizeCustomPomodoroMinutes(state.timer.customMinutes);
  }

  return TIMER_MODES[mode];
}

function getTimerDisplayMs() {
  const durationMs = getTimerDurationMs();
  const elapsedMs = getTimerElapsedMs();

  return durationMs ? Math.max(0, durationMs - elapsedMs) : elapsedMs;
}

function normalizeTimerMode(timerMode) {
  return Object.prototype.hasOwnProperty.call(TIMER_MODES, timerMode) ? timerMode : "stopwatch";
}

function normalizeCustomPomodoroMinutes(minutes) {
  const normalizedMinutes = Math.round(Number(minutes));
  if (!Number.isFinite(normalizedMinutes)) {
    return DEFAULT_CUSTOM_POMODORO_MINUTES;
  }

  return Math.min(
    Math.max(normalizedMinutes, MIN_CUSTOM_POMODORO_MINUTES),
    MAX_CUSTOM_POMODORO_MINUTES
  );
}

function setTimerMode(timerMode) {
  if (state.timer.isRunning || getTimerElapsedMs() > 0) {
    setStatus("Save elapsed time before changing timer mode.", true);
    updateTimerModeControls();
    return;
  }

  state.timer.mode = normalizeTimerMode(timerMode);
  state.timer.completed = false;
  updateTimerDisplay();
}

function handlePomodoroCustomChange() {
  const minutes = normalizeCustomPomodoroMinutes(elements.pomodoroCustomInput.value);
  elements.pomodoroCustomInput.value = String(minutes);

  if (state.timer.isRunning || getTimerElapsedMs() > 0) {
    setStatus("Save elapsed time before changing timer duration.", true);
    elements.pomodoroCustomInput.value = String(state.timer.customMinutes);
    return;
  }

  state.timer.customMinutes = minutes;
  if (state.timer.mode === "pomodoro-custom") {
    state.timer.completed = false;
    updateTimerDisplay();
  } else {
    updateTimerModeControls();
  }
}

function completePomodoroIfFinished() {
  const durationMs = getTimerDurationMs();
  if (!state.timer.isRunning || !durationMs || getTimerElapsedMs() < durationMs) {
    return;
  }

  if (state.timer.intervalId) {
    window.clearInterval(state.timer.intervalId);
  }

  state.timer.isRunning = false;
  state.timer.startedAt = null;
  state.timer.elapsedMs = durationMs;
  state.timer.intervalId = null;
  state.timer.completed = true;
  setStatus("Pomodoro complete. Save elapsed time when ready.");
}

function updateTimerModeControls() {
  const hasElapsed = getTimerElapsedMs() > 0;
  const controlsDisabled = !state.focusTask || state.timer.isRunning || hasElapsed;

  for (const button of elements.timerModeButtons) {
    const active = normalizeTimerMode(button.dataset.timerMode) === normalizeTimerMode(state.timer.mode);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = controlsDisabled;
  }

  elements.pomodoroCustomInput.value = String(
    normalizeCustomPomodoroMinutes(state.timer.customMinutes)
  );
  elements.pomodoroCustomInput.disabled =
    controlsDisabled || state.timer.mode !== "pomodoro-custom";
}

function updateTimerDisplay() {
  completePomodoroIfFinished();
  elements.focusTimer.textContent = formatDuration(getTimerDisplayMs());
  updateTimerModeControls();

  if (!state.focusTask) {
    renderDailyTimeSummary();
    publishFloatingTimerState();
    return;
  }

  const hasElapsed = getTimerElapsedMs() > 0;
  const isPomodoro = Boolean(getTimerDurationMs());
  const pomodoroFinished = isPomodoro && state.timer.completed;
  elements.startTimerButton.disabled = state.timer.isRunning;
  if (pomodoroFinished) {
    elements.startTimerButton.disabled = true;
    elements.startTimerButton.textContent = "Pomodoro Complete";
  } else if (hasElapsed && !state.timer.isRunning) {
    elements.startTimerButton.textContent = isPomodoro ? "Resume Pomodoro" : "Resume Focus";
  } else {
    elements.startTimerButton.textContent = isPomodoro ? "Start Pomodoro" : "Start Focus";
  }
  elements.stopTimerButton.disabled = !state.timer.isRunning && !hasElapsed;
  elements.stopTimerButton.textContent = state.timer.isRunning ? "Stop & Save" : "Save Elapsed";
  elements.clearFocusButton.disabled = state.timer.isRunning || hasElapsed;
  elements.completeFocusButton.disabled = state.timer.isRunning || hasElapsed;
  renderDailyTimeSummary();
  publishFloatingTimerState();
}

function publishFloatingTimerState() {
  if (!window.taskWidget?.updateFocusTimer) {
    return;
  }

  window.taskWidget.updateFocusTimer({
    hasFocusTask: Boolean(state.focusTask),
    taskName: state.focusTask?.name || "",
    mode: normalizeTimerMode(state.timer.mode),
    theme: state.settings?.theme || "dark",
    isRunning: state.timer.isRunning,
    startedAt: state.timer.isRunning ? state.timer.startedAt : null,
    elapsedMs: state.timer.isRunning ? state.timer.elapsedMs : getTimerElapsedMs(),
    durationMs: getTimerDurationMs(),
    completed: state.timer.completed
  });
}

function getFilteredTasks() {
  const tasks = getVisibleAvailableTasks();

  if (state.activeFilter === "all") {
    return tasks;
  }

  if (state.activeFilter === "due-soon") {
    return tasks.filter(isDueSoon);
  }

  if (state.activeFilter === "overdue") {
    return tasks.filter((task) => task.status === "overdue");
  }

  return tasks.filter((task) => !task.due);
}

function getVisibleAvailableTasks() {
  return applySelectedListFilter(getAvailableTasks());
}

function getAvailableTasks() {
  const plannedTaskIds = new Set([
    ...getQueueIds("today"),
    ...getQueueIds("week"),
    ...(state.focusTask?.id ? [state.focusTask.id] : [])
  ]);

  return state.tasks.filter((task) => !plannedTaskIds.has(task.id));
}

function applySelectedListFilter(tasks) {
  if (state.selectedListIds.size === 0) {
    return tasks;
  }

  return tasks.filter((task) => state.selectedListIds.has(task.listId));
}

function isDueSoon(task) {
  if (!task.due) {
    return false;
  }

  const dueDate = new Date(task.due);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const now = new Date();
  const dueSoonLimit = new Date(now);
  dueSoonLimit.setDate(now.getDate() + DUE_SOON_DAYS);

  return dueDate >= now && dueDate <= dueSoonLimit;
}

function renderFocus(task) {
  elements.focusEmpty.classList.toggle("hidden", Boolean(task));
  elements.focusActive.classList.toggle("hidden", !task);
  elements.focusHeaderOpenButton.disabled = !task?.url;
  renderFocusNotes(task);

  if (!task) {
    renderNextSuggestion();
    updateTimerDisplay();
    return;
  }

  elements.nextSuggestion.classList.add("hidden");
  elements.focusTitle.textContent = task.name;
  renderMeta(elements.focusMeta, task);
  elements.focusTimeTotal.textContent =
    task.timeSpentMins === null ? "Time spent: field not found" : `Time spent: ${task.timeSpentMins} mins`;
  updateTimerDisplay();
}

function renderNextSuggestion() {
  const task = state.nextSuggestion;
  elements.nextSuggestion.classList.toggle("hidden", !task);

  if (!task) {
    return;
  }

  elements.nextSuggestionTitle.textContent = task.name;
  renderMeta(elements.nextSuggestionMeta, task);
}

function renderFocusNotes(task) {
  if (!elements.focusNotesInput || !elements.focusNotesCount) {
    return;
  }

  elements.focusNotesInput.disabled = !task;
  for (const button of elements.focusNoteFormatButtons) {
    button.disabled = !task;
  }

  elements.focusNotesInput.value = task ? getFocusNote(task.id) : "";
  elements.focusNotesInput.placeholder = task
    ? "e.g. Things to look into, blockers, ideas..."
    : "Choose a focus task to start notes...";
  updateFocusNotesCount();
}

function applyNoteFormat(format) {
  const input = elements.focusNotesInput;
  if (!state.focusTask || !input || input.disabled) {
    return;
  }

  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const selectedText = input.value.slice(start, end);
  const formatted = getFormattedNoteText(format, selectedText);

  if (!formatted) {
    return;
  }

  const nextValue = `${input.value.slice(0, start)}${formatted.text}${input.value.slice(end)}`;
  if (nextValue.length > FOCUS_NOTES_MAX_LENGTH) {
    setStatus("Focus note is already at the character limit.", true);
    return;
  }

  input.value = nextValue;
  input.focus();
  input.setSelectionRange(start + formatted.selectionStart, start + formatted.selectionEnd);
  handleFocusNotesInput();
}

function getFormattedNoteText(format, selectedText) {
  if (format === "bold") {
    const text = selectedText || "bold text";
    return {
      text: `**${text}**`,
      selectionStart: 2,
      selectionEnd: 2 + text.length
    };
  }

  if (format === "italic") {
    const text = selectedText || "italic text";
    return {
      text: `*${text}*`,
      selectionStart: 1,
      selectionEnd: 1 + text.length
    };
  }

  if (format === "list") {
    if (!selectedText) {
      return {
        text: "- List item",
        selectionStart: 2,
        selectionEnd: 11
      };
    }

    const text = selectedText
      .split(/\r?\n/)
      .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
      .join("\n");

    return {
      text,
      selectionStart: 0,
      selectionEnd: text.length
    };
  }

  if (format === "link") {
    const text = selectedText || "link text";
    return {
      text: `[${text}](url)`,
      selectionStart: text.length + 3,
      selectionEnd: text.length + 6
    };
  }

  return null;
}

function handleFocusNotesInput() {
  if (!state.focusTask) {
    elements.focusNotesInput.value = "";
    updateFocusNotesCount();
    return;
  }

  const note = elements.focusNotesInput.value.slice(0, FOCUS_NOTES_MAX_LENGTH);
  if (note !== elements.focusNotesInput.value) {
    elements.focusNotesInput.value = note;
  }

  saveFocusNote(state.focusTask.id, note);
  updateFocusNotesCount();
}

function updateFocusNotesCount() {
  const length = elements.focusNotesInput?.value.length || 0;
  elements.focusNotesCount.textContent = `${length} / ${FOCUS_NOTES_MAX_LENGTH}`;
}

function getFocusNote(cardId) {
  return loadFocusNotes()[cardId] || "";
}

function saveFocusNote(cardId, note) {
  const notes = loadFocusNotes();
  const normalizedNote = String(note || "");

  if (normalizedNote) {
    notes[cardId] = normalizedNote;
  } else {
    delete notes[cardId];
  }

  try {
    window.localStorage.setItem(FOCUS_NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    setStatus("Could not save focus note locally.", true);
  }
}

function deleteFocusNote(cardId) {
  const notes = loadFocusNotes();
  delete notes[cardId];

  try {
    window.localStorage.setItem(FOCUS_NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch {
    setStatus("Could not clear the local focus note.", true);
  }
}

async function syncFocusNoteToTrello(task) {
  if (!task?.id) {
    return false;
  }

  const note = getFocusNote(task.id).trim();
  if (!note) {
    return false;
  }

  setStatus("Saving focus note to Trello...");
  await window.taskWidget.addComment(task.id, note);
  deleteFocusNote(task.id);

  if (state.focusTask?.id === task.id) {
    elements.focusNotesInput.value = "";
    updateFocusNotesCount();
  }

  return true;
}

function loadFocusNotes() {
  try {
    const notes = JSON.parse(window.localStorage.getItem(FOCUS_NOTES_STORAGE_KEY) || "{}");
    return notes && typeof notes === "object" && !Array.isArray(notes) ? notes : {};
  } catch {
    return {};
  }
}

function renderTaskList(tasks) {
  elements.taskList.innerHTML = "";

  for (const task of tasks) {
    const item = document.createElement("article");
    item.className = "task-item";
    item.classList.toggle("active-focus", task.id === state.focusTask?.id);

    const completeCheckbox = createCompleteCheckbox(task, item);
    const title = document.createElement("h3");
    title.textContent = task.name;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    renderMeta(meta, task);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const todayButton = createActionButton(
      isQueued("today", task.id) ? "Remove Today" : "Add Today",
      "secondary-button",
      () => toggleQueuedTask("today", task.id)
    );

    const weekButton = createActionButton(
      isQueued("week", task.id) ? "Remove Week" : "Add Week",
      "secondary-button",
      () => toggleQueuedTask("week", task.id)
    );

    const focusButton = document.createElement("button");
    focusButton.className = "secondary-button";
    focusButton.type = "button";
    focusButton.textContent = task.id === state.focusTask?.id ? "Focused" : "Focus";
    focusButton.disabled = state.timer.isRunning || state.timer.elapsedMs > 0;
    focusButton.addEventListener("click", () => setFocusTask(task));

    const openButton = document.createElement("button");
    openButton.className = "secondary-button";
    openButton.type = "button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => openTask(task.url));

    actions.append(todayButton, weekButton, focusButton, openButton);
    item.append(completeCheckbox, title, meta, actions);
    elements.taskList.append(item);
  }
}

function renderMeta(container, task) {
  container.innerHTML = "";
  container.append(createPill(task.listName, "list-pill"));

  if (task.due) {
    container.append(createPill(formatDue(task), `due-pill ${task.status}`));
  } else {
    container.append(createPill("No due date", "no-date-pill"));
  }

  if (task.timeSpentMins !== null) {
    container.append(createPill(`${task.timeSpentMins} mins tracked`, "time-pill"));
  }

  for (const label of task.labels) {
    container.append(createPill(label.name, `label-pill ${label.color}`));
  }
}

function createPill(text, extraClass = "") {
  const pill = document.createElement("span");
  pill.className = extraClass.startsWith("label-pill")
    ? extraClass
    : `meta-pill ${extraClass}`.trim();
  pill.textContent = text;
  return pill;
}

function formatDue(task) {
  const due = new Date(task.due);
  const date = due.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
  const time = due.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  if (task.status === "overdue") {
    return `Overdue ${date}, ${time}`;
  }

  if (task.status === "today") {
    return `Today, ${time}`;
  }

  return `${date}, ${time}`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatSummaryDuration(minutes) {
  const totalMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

async function completeTask(cardId) {
  if (!cardId) {
    return false;
  }

  const completingFocusTask = cardId === state.focusTask?.id;
  const completedTask =
    state.tasks.find((task) => task.id === cardId) ||
    (completingFocusTask ? state.focusTask : null) ||
    { id: cardId };

  if (completingFocusTask && (state.timer.isRunning || state.timer.elapsedMs > 0)) {
    setStatus("Save the current timer before completing this task.", true);
    return false;
  }

  setLoading(true);
  setStatus(completingFocusTask ? "Completing focus..." : "Marking complete...");

  try {
    if (completingFocusTask) {
      await syncFocusNoteToTrello(state.focusTask);
      setStatus("Marking complete...");
    }

    const result = await window.taskWidget.completeCard(cardId);
    if (result?.settings) {
      state.settings = result.settings;
    }
    recordCompletedTask(completedTask);
    state.tasks = state.tasks.filter((task) => task.id !== cardId);
    if (completingFocusTask) {
      state.focusTask = null;
      resetTimer();
      setNextSuggestionFromToday(cardId);
    }
    renderTasks();
    setStatus("Marked complete.");
    return true;
  } catch (error) {
    setStatus(error.message, true);
    return false;
  } finally {
    setLoading(false);
  }
}

async function openTask(url) {
  if (!url) {
    return;
  }

  try {
    await window.taskWidget.openExternal(url);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function setLoading(isLoading) {
  document.body.classList.toggle("loading", isLoading);
}

function setStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.style.color = isError ? "var(--danger)" : "var(--muted)";
}

init();
