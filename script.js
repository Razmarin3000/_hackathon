import {
  OFFLINE_MODES,
  RESTART_DEBOUNCE_MS,
} from "./src/game/config.js";
import {
  SNAKES,
  TRACK_DEFS,
} from "./src/game/catalog.js";
import { ui, state, isDebugMode, setOfflineMode, updateOfflineModeUi } from "./src/game/state.js";
import { createRaceDurationStatsApi } from "./src/game/raceDurationStats.js";
import { initSnakeTitleWave } from "./src/game/titleWave.js";
import { createAiApi } from "./src/game/ai.js";
import { createRaceFlowApi } from "./src/game/raceFlow.js";
import { createRaceState, randomizeBodyItemPosition } from "./src/game/raceSetup.js";
import { createHudApi } from "./src/game/hud.js";
import { createSceneApi } from "./src/game/scene.js";
import { createUiFlowApi } from "./src/game/uiFlow.js";
import { createCoreUiApi } from "./src/game/coreUi.js";
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

const {
  showOverlayMessage,
  triggerCountdownBurst,
  renderRace,
  renderIdle,
  loadBestTime,
  formatMs,
  showToast,
} = createCoreUiApi({
  ui,
  state,
  getRacerMotionHeading,
});

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
