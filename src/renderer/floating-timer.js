const elements = {
  container: document.querySelector(".floating-timer"),
  timerLabel: document.querySelector("#timerLabel"),
  timerValue: document.querySelector("#timerValue")
};

let timerState = null;
let tickTimer = null;
let dragState = null;
let suppressNextClick = false;

const DRAG_THRESHOLD_PX = 4;

async function init() {
  elements.container.addEventListener("pointerdown", startPointerDrag);
  elements.container.addEventListener("pointermove", movePointerDrag);
  elements.container.addEventListener("pointerup", endPointerDrag);
  elements.container.addEventListener("pointercancel", cancelPointerDrag);
  elements.container.addEventListener("lostpointercapture", cancelPointerDrag);
  elements.container.addEventListener("click", handleClick);
  elements.container.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openMainWindow();
  });
  window.floatingTimer.onStateChanged(applyTimerState);
  applyTimerState(await window.floatingTimer.getState());
}

function startPointerDrag(event) {
  if (event.button !== 0) {
    return;
  }

  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    dragging: false
  };

  try {
    elements.container.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is a best-effort improvement for dragging near window edges.
  }
}

function movePointerDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  if (!dragState.dragging) {
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
      return;
    }

    dragState.dragging = true;
    document.body.classList.add("is-dragging");
    window.floatingTimer.startDrag();
  }

  event.preventDefault();
  window.floatingTimer.moveDrag();
}

function endPointerDrag(event) {
  finishPointerDrag(event);
}

function cancelPointerDrag(event) {
  finishPointerDrag(event, true);
}

function finishPointerDrag(event, cancelled = false) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  if (dragState.dragging) {
    suppressNextClick = !cancelled;
    event.preventDefault();
    window.floatingTimer.endDrag();
  }

  document.body.classList.remove("is-dragging");

  if (elements.container.hasPointerCapture?.(event.pointerId)) {
    try {
      elements.container.releasePointerCapture(event.pointerId);
    } catch {
      // Releasing a missing pointer capture is harmless.
    }
  }

  dragState = null;
}

function handleClick(event) {
  if (suppressNextClick) {
    suppressNextClick = false;
    event.preventDefault();
    return;
  }

  openMainWindow();
}

async function openMainWindow() {
  try {
    await window.floatingTimer.openMainWindow();
  } catch {
    // The floating timer is secondary UI; ignore failures opening the main window.
  }
}

function applyTimerState(nextTimerState) {
  timerState = normalizeTimerState(nextTimerState);
  restartTicker();
  render();
}

function normalizeTimerState(nextTimerState) {
  const elapsedMs = Number(nextTimerState?.elapsedMs);
  const durationMs = Number(nextTimerState?.durationMs);
  const startedAt = Number(nextTimerState?.startedAt);

  return {
    hasFocusTask: Boolean(nextTimerState?.hasFocusTask),
    taskName: String(nextTimerState?.taskName || ""),
    mode: String(nextTimerState?.mode || "stopwatch"),
    theme: nextTimerState?.theme === "light" ? "light" : "dark",
    isRunning: Boolean(nextTimerState?.isRunning),
    startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : null,
    elapsedMs: Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0,
    durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null,
    completed: Boolean(nextTimerState?.completed)
  };
}

function restartTicker() {
  if (tickTimer) {
    window.clearInterval(tickTimer);
    tickTimer = null;
  }

  if (timerState?.isRunning) {
    tickTimer = window.setInterval(render, 1000);
  }
}

function render() {
  const displayMs = getDisplayMs();
  const complete = isTimerComplete();
  const paused = timerState?.hasFocusTask && !timerState.isRunning && !complete && getElapsedMs() > 0;

  document.body.classList.toggle("theme-light", timerState?.theme === "light");
  document.body.classList.toggle("theme-dark", timerState?.theme !== "light");
  document.body.classList.toggle("is-paused", paused);
  document.body.classList.toggle("is-complete", complete);

  const timerLabel = getTimerLabel();
  elements.timerLabel.textContent = timerLabel;
  elements.timerLabel.title = timerState?.taskName || "";
  elements.timerValue.textContent = formatDuration(displayMs);
  document.title = timerState?.taskName
    ? `${elements.timerValue.textContent} - ${timerState.taskName}`
    : `Work Slate Timer - ${elements.timerValue.textContent}`;
}

function getTimerLabel() {
  return timerState?.taskName || "Focus";
}

function getElapsedMs() {
  if (!timerState) {
    return 0;
  }

  let elapsedMs = timerState.elapsedMs;

  if (timerState.isRunning && timerState.startedAt) {
    elapsedMs += Date.now() - timerState.startedAt;
  }

  if (!timerState.durationMs) {
    return Math.max(0, elapsedMs);
  }

  return Math.min(Math.max(0, elapsedMs), timerState.durationMs);
}

function getDisplayMs() {
  const elapsedMs = getElapsedMs();

  if (!timerState?.durationMs) {
    return elapsedMs;
  }

  return Math.max(0, timerState.durationMs - elapsedMs);
}

function isTimerComplete() {
  return Boolean(
    timerState?.hasFocusTask &&
      timerState.durationMs &&
      (timerState.completed || getElapsedMs() >= timerState.durationMs)
  );
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

init();
