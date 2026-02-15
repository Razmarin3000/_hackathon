import { createNpcSteeringApi } from "./aiSteering.js";
import { createVenomSystemApi } from "./venomSystem.js";

export function createAiApi({ shouldNeverStop, getCurrentBodySegments, addEffect, removeEffect } = {}) {
  const venomApi = createVenomSystemApi({ addEffect, removeEffect });
  const steeringApi = createNpcSteeringApi({
    shouldNeverStop,
    getCurrentBodySegments,
    canNpcShootVenom: venomApi.canNpcShootVenom,
  });

  return {
    buildNpcControl: steeringApi.buildNpcControl,
    maybeShootVenom: venomApi.maybeShootVenom,
    updateVenomShots: venomApi.updateVenomShots,
  };
}
