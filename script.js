import {
  OFFLINE_MODES,
  STORAGE_PREFIX,
  RESTART_DEBOUNCE_MS,
  NO_TIME_LABEL,
  COUNTDOWN_BURST_ANIM_CLASS,
  COUNTDOWN_COLORS,
} from "./src/game/config.js";
import {
  SNAKES,
  TRACK_DEFS,
} from "./src/game/catalog.js";
import { renderRace as renderRaceView, renderIdle as renderIdleView } from "./src/game/render.js";
import { ui, state, isDebugMode, setOfflineMode, updateOfflineModeUi } from "./src/game/state.js";
import { createRaceDurationStatsApi } from "./src/game/raceDurationStats.js";
import { initSnakeTitleWave } from "./src/game/titleWave.js";
import { createAiApi } from "./src/game/ai.js";
import { createRaceFlowApi } from "./src/game/raceFlow.js";
import { createRaceState, randomizeBodyItemPosition } from "./src/game/raceSetup.js";
import { createHudApi } from "./src/game/hud.js";
import { createSceneApi } from "./src/game/scene.js";
import { createUiFlowApi } from "./src/game/uiFlow.js";
import {
  stepFinishedRacer,
  updatePickups,
  updateBodyItems,
  updateRacerHunger,
  checkPickupCollection,
  checkBodyItemCollection,
  getCurrentBodySegments,
  addEffect,
  removeEffect,
  updateBodySegmentsForRace,
  getRacerMotionHeading,
  stepRacer,
  shouldNeverStop,
  ensureAlwaysMoveSpeed,
  applyBodyCrossingRules,
  preventRacerStall,
  resolveRacerCollisions,
  updateCheckpointProgress,
  computeStandings,
} from "./src/game/simulation.js";

const { maybePrefetchRemoteRaceDurationStats, getTitleCrawlDurationMs, updateRaceDurationStats } =
  createRaceDurationStatsApi({ loadBestTime });
const { buildNpcControl, maybeShootVenom, updateVenomShots } = createAiApi({
  shouldNeverStop,
  getCurrentBodySegments,
  addEffect,
  removeEffect,
});
const { updateHud, formatRacerProgressLabel } = createHudApi({
  ui,
  computeStandings,
  getCurrentBodySegments,
  formatMs,
});
let syncRaceMusicRef = () => {};
const {
  wireUi,
  showScreen,
  renderSnakeCards,
  renderTrackCards,
  startRace,
} = createUiFlowApi({
  ui,
  state,
  OFFLINE_MODES,
  setOfflineMode,
  TRACK_DEFS,
  SNAKES,
  isDebugMode,
  createRaceState,
  syncRaceMusic: (...args) => syncRaceMusicRef(...args),
  showToast,
  loadBestTime,
  formatMs,
  RESTART_DEBOUNCE_MS,
});
const { updateRace } = createRaceFlowApi({
  ui,
  state,
  ensureAlwaysMoveSpeed,
  updateBodySegmentsForRace,
  updatePickups,
  updateBodyItems,
  stepFinishedRacer,
  updateRacerHunger,
  buildNpcControl,
  stepRacer,
  applyBodyCrossingRules,
  preventRacerStall,
  maybeShootVenom,
  updateCheckpointProgress,
  checkPickupCollection,
  checkBodyItemCollection,
  updateVenomShots,
  resolveRacerCollisions,
  computeStandings,
  randomizeBodyItemPosition,
  showOverlayMessage,
  triggerCountdownBurst,
  updateHud,
  updateRaceDurationStats,
  renderTrackCards,
  showScreen,
  loadBestTime,
  formatMs,
  formatRacerProgressLabel,
});
const { initPhaser, syncRaceMusic } = createSceneApi({
  ui,
  state,
  updateRace,
  renderRace,
  renderIdle,
});
syncRaceMusicRef = syncRaceMusic;

// -----------------------------
// App Bootstrap and UI Wiring
// -----------------------------
bootstrap();

function bootstrap() {
  initSnakeTitleWave({
    getCurrentScreen: () => state.currentScreen,
    getRaceStageWidth: () => ui.raceStage?.clientWidth || 0,
    getTitleCrawlDurationMs,
  });
  maybePrefetchRemoteRaceDurationStats();
  wireUi();
  renderSnakeCards();
  renderTrackCards();
  updateOfflineModeUi();
  showScreen("main");
  initPhaser();
}

function showOverlayMessage(text, mode = "", color = null) {
  ui.overlay.textContent = text;
  ui.overlay.classList.remove("countdown", COUNTDOWN_BURST_ANIM_CLASS, "overlay-go", "overlay-finish");
  if (mode) {
    ui.overlay.classList.add(mode);
  }
  if (color) {
    ui.overlay.style.setProperty("--overlay-color", color);
  } else {
    ui.overlay.style.removeProperty("--overlay-color");
  }
  ui.overlay.classList.add("visible");
}

function triggerCountdownBurst(value) {
  const color = COUNTDOWN_COLORS[value] || "#f0f5ff";
  showOverlayMessage(String(value), "countdown", color);
  ui.overlay.classList.remove(COUNTDOWN_BURST_ANIM_CLASS);
  // Force reflow so CSS animation restarts on every digit.
  void ui.overlay.offsetWidth;
  ui.overlay.classList.add(COUNTDOWN_BURST_ANIM_CLASS);
}

// -----------------------------
// Race Loop and Simulation
// -----------------------------
function renderRace(scene, race, nowMs) {
  return renderRaceView(scene, race, nowMs, { formatMs, getRacerMotionHeading });
}

function renderIdle(scene) {
  return renderIdleView(scene, { getRacerMotionHeading });
}

// -----------------------------
// Track Geometry and Utilities
// -----------------------------
function loadBestTime(trackId) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${trackId}`);
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) {
    return NO_TIME_LABEL;
  }
  const clean = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(clean / 60000);
  const seconds = Math.floor((clean % 60000) / 1000);
  const millis = clean % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function showToast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  if (state.toastTimeout) {
    clearTimeout(state.toastTimeout);
  }
  state.toastTimeout = setTimeout(() => ui.toast.classList.remove("show"), 1900);
}
