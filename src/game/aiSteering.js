import {
  APPLE_STARTLINE_AVOID_RADIUS,
  NPC_HAZARD_LOOKAHEAD_DELTA,
  NPC_BOMB_AVOID_RADIUS,
  NPC_CACTUS_AVOID_RADIUS,
  NPC_BOMB_AVOID_WEIGHT,
  NPC_CACTUS_AVOID_WEIGHT,
  NPC_HAZARD_AVOID_MAX_SHIFT,
  NPC_EDGE_CAUTION_START_RATIO,
  NPC_EDGE_AVOID_LOOKAHEAD,
  ALWAYS_MOVE_MIN_SPEED,
  MIN_BODY_SEGMENTS,
} from "./config.js";
import {
  clamp,
  lerp,
  sqrDistance,
  shortestAngle,
  normalizeVec,
  mod1,
  forwardTrackDelta,
} from "./utils.js";
import { sampleTrack, projectOnTrack } from "./trackMath.js";

export function createNpcSteeringApi({
  shouldNeverStop,
  getCurrentBodySegments,
  canNpcShootVenom,
} = {}) {
  const getSegments = (racer) =>
    typeof getCurrentBodySegments === "function"
      ? getCurrentBodySegments(racer)
      : Number.isFinite(racer?.bodySegments)
        ? racer.bodySegments
        : MIN_BODY_SEGMENTS;

  const shouldCrawl = (racer) => (typeof shouldNeverStop === "function" ? shouldNeverStop(racer) : false);

  function buildNpcControl(race, racer, nowMs) {
    const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
    const lookAheadDistance = racer.profile.lookAhead + racer.speed * 0.32;
    const targetFraction = mod1(projection.tNorm + lookAheadDistance / race.track.totalLength);
    const trackTarget = sampleTrack(race.track, targetFraction);
    const appleTarget = findNpcAppleTarget(race, racer, projection);
    const blendedTarget = blendNpcTarget(trackTarget, appleTarget, racer);
    const hazardAvoidance = findNpcHazardAvoidance(race, racer, projection);
    const edgeAvoidance = findNpcEdgeAvoidance(race, racer, projection);
    const hazardTarget = applyNpcHazardAvoidanceTarget(race, blendedTarget, hazardAvoidance);
    let target = hazardTarget;
    if (edgeAvoidance?.target) {
      const edgeBlend = lerp(0.62, 0.99, edgeAvoidance.intensity);
      target = {
        x: lerp(target.x, edgeAvoidance.target.x, edgeBlend),
        y: lerp(target.y, edgeAvoidance.target.y, edgeBlend),
      };
    }
    const appleAttraction = getNpcAppleAttraction(racer);
    const hazardIntensity = hazardAvoidance?.intensity || 0;
    const edgeIntensity = edgeAvoidance?.intensity || 0;
    const caution = clamp(hazardIntensity * 0.7 + edgeIntensity * 1.4, 0, 1);
    const desiredHeading = Math.atan2(target.y - racer.y, target.x - racer.x);
    const angle = shortestAngle(racer.heading, desiredHeading);
    const neverStop = shouldCrawl(racer);

    let throttle = 1;
    let brake = 0;
    if (Math.abs(angle) > racer.profile.brakeAngle) {
      throttle = 0.42;
      brake = 0.26;
    }
    if (racer.surface !== "road") {
      throttle = Math.min(throttle, racer.surface === "outside" ? 0.46 : 0.66);
      brake = Math.max(brake, racer.surface === "outside" ? 0.32 : 0.16);
    }
    const underBombSlow = racer.effects.some((effect) => effect.type === "BOMB_SLOW");
    if (underBombSlow) {
      throttle = Math.max(throttle, 0.82);
      brake = Math.max(brake, 0.06);
    }
    if (appleAttraction > 0 && caution < 0.34 && edgeIntensity < 0.22) {
      throttle = Math.max(throttle, lerp(0.9, 1, appleAttraction));
      brake = Math.min(brake, lerp(0.14, 0, appleAttraction));
    }
    if (caution > 0) {
      throttle = Math.min(throttle, lerp(0.84, 0.34, caution));
      brake = Math.max(brake, lerp(0.08, 0.42, caution));
    }
    if (edgeIntensity > 0.35) {
      throttle = Math.min(throttle, 0.62);
      brake = Math.max(brake, 0.14);
    }
    if (edgeIntensity > 0.58) {
      throttle = Math.min(throttle, 0.44);
      brake = Math.max(brake, 0.26);
    }
    if (edgeIntensity > 0.78) {
      throttle = Math.min(throttle, 0.28);
      brake = Math.max(brake, 0.42);
    }
    if (racer.speed < 12) {
      if (caution < 0.55) {
        throttle = Math.max(throttle, 0.92);
        brake = 0;
      } else {
        throttle = Math.max(throttle, 0.7);
        brake = Math.max(brake, 0.12);
      }
    }
    if (neverStop) {
      const cautiousMode = caution >= 0.2 || racer.surface !== "road";
      if (!cautiousMode) {
        throttle = Math.max(throttle, 0.96);
        brake = 0;
        if (racer.speed < ALWAYS_MOVE_MIN_SPEED * 0.7) {
          throttle = 1;
        }
      } else {
        throttle = Math.max(throttle, edgeIntensity > 0.62 ? 0.34 : 0.5);
        brake = Math.max(brake, lerp(0.1, 0.34, clamp(caution + edgeIntensity * 0.32, 0, 1)));
      }
    }

    const steerGain = racer.profile.steerGain * (1 + caution * 0.65 + edgeIntensity * 0.9);
    const spit = typeof canNpcShootVenom === "function" ? canNpcShootVenom(race, racer, nowMs) : false;

    return {
      throttle: clamp(throttle, 0, 1),
      brake: clamp(brake, 0, 1),
      turn: clamp(angle * steerGain, -1, 1),
      spit,
    };
  }

  function getNpcAppleAttraction(racer) {
    if (!racer) {
      return 0;
    }
    const hungerSteps = Math.max(0, racer.exhaustionSteps || 0);
    const hungerAttraction = clamp(hungerSteps / 5, 0, 1);
    const bodySegments = getSegments(racer);
    const emergencyBonus = bodySegments <= MIN_BODY_SEGMENTS + 1 ? 0.18 : 0;
    return clamp(hungerAttraction + emergencyBonus, 0, 1);
  }

  function findNpcAppleTarget(race, racer, racerProjection) {
    const bodySegments = getSegments(racer);
    const attraction = getNpcAppleAttraction(racer);
    if (attraction <= 0.02 && bodySegments >= racer.baseBodySegments + 2) {
      return null;
    }
    const startCheckpoint = race.track.checkpoints?.[0];
    const maxForwardDelta = lerp(0.18, 0.42, attraction);
    const maxDistance = lerp(235, 520, attraction);
    const forwardWeight = lerp(0.75, 0.34, attraction);
    const distanceNorm = lerp(850, 1300, attraction);
    let best = null;
    for (const item of race.bodyItems) {
      if (!item.active || item.type !== "APPLE") {
        continue;
      }
      if (startCheckpoint && sqrDistance(item.x, item.y, startCheckpoint.x, startCheckpoint.y) < APPLE_STARTLINE_AVOID_RADIUS ** 2) {
        continue;
      }
      const itemProjection = projectOnTrack(race.track, item.x, item.y);
      const forwardDelta = forwardTrackDelta(racerProjection.tNorm, itemProjection.tNorm);
      if (forwardDelta <= 0.0001 || forwardDelta > maxForwardDelta) {
        continue;
      }
      const dist = Math.hypot(item.x - racer.x, item.y - racer.y);
      if (dist > maxDistance) {
        continue;
      }
      const score = forwardDelta * forwardWeight + dist / distanceNorm;
      if (!best || score < best.score) {
        best = { item, score };
      }
    }
    return best ? best.item : null;
  }

  function blendNpcTarget(trackTarget, appleTarget, racer) {
    if (!appleTarget) {
      return trackTarget;
    }
    const attraction = getNpcAppleAttraction(racer);
    const appleDist = Math.hypot(appleTarget.x - racer.x, appleTarget.y - racer.y);
    const maxDistance = lerp(300, 700, attraction);
    const minWeight = lerp(0.1, 0.72, attraction);
    const maxWeight = lerp(0.44, 0.95, attraction);
    const appleWeight = clamp(1 - appleDist / maxDistance, minWeight, maxWeight);
    return {
      x: lerp(trackTarget.x, appleTarget.x, appleWeight),
      y: lerp(trackTarget.y, appleTarget.y, appleWeight),
    };
  }

  function findNpcHazardAvoidance(race, racer, racerProjection) {
    if (!race?.track || !racer || !racerProjection) {
      return { x: 0, y: 0, intensity: 0 };
    }

    let avoidX = 0;
    let avoidY = 0;
    let totalInfluence = 0;

    const hazards = [];
    for (const pickup of race.pickups) {
      if (pickup.active && pickup.type === "BOMB") {
        hazards.push({
          x: pickup.x,
          y: pickup.y,
          radius: NPC_BOMB_AVOID_RADIUS,
          weight: NPC_BOMB_AVOID_WEIGHT,
        });
      }
    }
    for (const item of race.bodyItems) {
      if (item.active && item.type === "CACTUS") {
        hazards.push({
          x: item.x,
          y: item.y,
          radius: NPC_CACTUS_AVOID_RADIUS,
          weight: NPC_CACTUS_AVOID_WEIGHT,
        });
      }
    }

    for (const hazard of hazards) {
      const hazardProjection = projectOnTrack(race.track, hazard.x, hazard.y);
      if (!hazardProjection) {
        continue;
      }

      const forwardDelta = forwardTrackDelta(racerProjection.tNorm, hazardProjection.tNorm);
      if (forwardDelta <= 0.0001 || forwardDelta > NPC_HAZARD_LOOKAHEAD_DELTA) {
        continue;
      }

      const dist = Math.hypot(racer.x - hazard.x, racer.y - hazard.y);
      if (dist >= hazard.radius) {
        continue;
      }

      const distanceFactor = 1 - dist / hazard.radius;
      const forwardFactor = 1 - forwardDelta / NPC_HAZARD_LOOKAHEAD_DELTA;
      const influence = hazard.weight * distanceFactor * forwardFactor;
      if (influence <= 0) {
        continue;
      }

      const repel = normalizeVec(racer.x - hazard.x, racer.y - hazard.y);
      avoidX += repel.x * influence;
      avoidY += repel.y * influence;
      totalInfluence += influence;
    }

    if (totalInfluence <= 0.0001) {
      return { x: 0, y: 0, intensity: 0 };
    }

    const dir = normalizeVec(avoidX, avoidY);
    const intensity = clamp(totalInfluence / (NPC_BOMB_AVOID_WEIGHT + NPC_CACTUS_AVOID_WEIGHT), 0, 1);
    return {
      x: dir.x,
      y: dir.y,
      intensity,
    };
  }

  function applyNpcHazardAvoidanceTarget(race, target, hazardAvoidance) {
    if (!target || !hazardAvoidance || hazardAvoidance.intensity <= 0) {
      return target;
    }

    const shift = NPC_HAZARD_AVOID_MAX_SHIFT * hazardAvoidance.intensity;
    const shiftedX = target.x + hazardAvoidance.x * shift;
    const shiftedY = target.y + hazardAvoidance.y * shift;

    const projection = projectOnTrack(race.track, shiftedX, shiftedY);
    if (!projection) {
      return { x: shiftedX, y: shiftedY };
    }
    const normal = { x: -projection.tangent.y, y: projection.tangent.x };
    const dx = shiftedX - projection.x;
    const dy = shiftedY - projection.y;
    const lateral = clamp(dx * normal.x + dy * normal.y, -race.track.roadWidth * 0.74, race.track.roadWidth * 0.74);
    return {
      x: projection.x + normal.x * lateral,
      y: projection.y + normal.y * lateral,
    };
  }

  function findNpcEdgeAvoidance(race, racer, racerProjection) {
    if (!race?.track || !racerProjection) {
      return { target: null, intensity: 0 };
    }

    const cautionStart = race.track.roadWidth * NPC_EDGE_CAUTION_START_RATIO;
    const range = Math.max(1, race.track.outsideWidth - cautionStart);
    const raw = clamp((racerProjection.distance - cautionStart) / range, 0, 1);
    let intensity = clamp(Math.pow(raw, 0.62) * 1.08, 0, 1);
    if (racer.surface === "outside") {
      intensity = 1;
    } else if (racer.surface === "offroad") {
      intensity = Math.max(intensity, 0.68);
    }
    if (intensity <= 0.001) {
      return { target: null, intensity: 0 };
    }

    const ahead = sampleTrack(race.track, mod1(racerProjection.tNorm + NPC_EDGE_AVOID_LOOKAHEAD + intensity * 0.018));
    const normal = { x: -ahead.tangent.y, y: ahead.tangent.x };
    const dx = racer.x - ahead.x;
    const dy = racer.y - ahead.y;
    const lateral = dx * normal.x + dy * normal.y;
    const lateralSign = Math.sign(lateral) || 1;
    const headingX = Math.cos(racer.heading);
    const headingY = Math.sin(racer.heading);
    const outwardNormalX = normal.x * lateralSign;
    const outwardNormalY = normal.y * lateralSign;
    const outwardDot = headingX * outwardNormalX + headingY * outwardNormalY;
    if (outwardDot > 0) {
      intensity = clamp(intensity + outwardDot * 0.26, 0, 1);
    }

    const safeLimit = lerp(race.track.roadWidth * 0.52, race.track.roadWidth * 0.16, intensity);
    const safeLateral = clamp(lateral, -safeLimit, safeLimit);
    const laneTarget = {
      x: ahead.x + normal.x * safeLateral,
      y: ahead.y + normal.y * safeLateral,
    };
    const centerBlend = lerp(0.54, 0.96, intensity);

    return {
      target: {
        x: lerp(laneTarget.x, ahead.x, centerBlend),
        y: lerp(laneTarget.y, ahead.y, centerBlend),
      },
      intensity,
    };
  }

  return {
    buildNpcControl,
  };
}
