import {
  CROSS_ACCEL_SNAKE_ID,
  BODY_CROSS_SLOWDOWN_MUL,
  SPEEDSTER_BODY_BLOCK_PUSH,
  BODY_CROSSING_EFFECT_COOLDOWN_MS,
  SPEEDSTER_BLOCK_EXTRA_TURN,
  SPEEDSTER_BLOCK_NUDGE,
  SPEEDSTER_BLOCK_MAX_SHIFT,
  SPEEDSTER_BLOCK_FORWARD_STEP,
} from "./config.js";
import {
  sqrDistance,
  shortestAngle,
  wrapAngle,
  mod1,
} from "./utils.js";
import { projectOnTrack, sampleTrack } from "./trackMath.js";
import {
  applyBodySegmentDelta,
  ensureAlwaysMoveSpeed,
} from "./simBodySystem.js";

function applyBodyCrossingRules(race, racer, nowMs) {
  if (racer.finished) {
    return;
  }
  if (nowMs < (racer.unstuckUntilMs || 0)) {
    return;
  }
  if (nowMs < (race.bodyCrossingGraceUntilMs || 0)) {
    return;
  }

  const headRadius = 10;
  for (const other of race.racers) {
    if (other.id === racer.id || other.finished || nowMs < (other.unstuckUntilMs || 0) || !other.bodySegments?.length) {
      continue;
    }

    const tail = other.bodySegments[other.bodySegments.length - 1];
    if (
      racer.typeId === "trickster" &&
      tail &&
      nowMs >= (racer.tailBiteCooldownUntilMs || 0) &&
      sqrDistance(racer.x, racer.y, tail.x, tail.y) <= (headRadius + tail.radius + 2) ** 2
    ) {
      const bitten = applyBodySegmentDelta(other, -1, nowMs, "BITE");
      if (bitten) {
        racer.tailBiteCooldownUntilMs = nowMs + 900;
      }
    }

    for (const segment of other.bodySegments) {
      const limit = headRadius + segment.radius;
      const dx = racer.x - segment.x;
      const dy = racer.y - segment.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > limit * limit) {
        continue;
      }

      if (racer.typeId === "speedster") {
        const dist = Math.sqrt(Math.max(0.0001, distSq));
        const nx = dx / dist;
        const ny = dy / dist;
        const push = limit + Math.max(2, SPEEDSTER_BODY_BLOCK_PUSH * 0.5);
        const desiredX = segment.x + nx * push;
        const desiredY = segment.y + ny * push;
        const shiftX = desiredX - racer.x;
        const shiftY = desiredY - racer.y;
        const shiftLen = Math.hypot(shiftX, shiftY);
        if (shiftLen > 0.001) {
          const shiftStep = Math.min(SPEEDSTER_BLOCK_MAX_SHIFT, shiftLen);
          racer.x += (shiftX / shiftLen) * shiftStep;
          racer.y += (shiftY / shiftLen) * shiftStep;
        }
        const tangentSign = Math.sign(shortestAngle(racer.heading, segment.heading || racer.heading)) || 1;
        racer.heading = wrapAngle(racer.heading + SPEEDSTER_BLOCK_EXTRA_TURN * tangentSign);
        const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
        const ahead = sampleTrack(race.track, mod1(projection.tNorm + 0.011));
        const forwardHeading = Math.atan2(ahead.y - racer.y, ahead.x - racer.x);
        racer.heading = wrapAngle(racer.heading + shortestAngle(racer.heading, forwardHeading) * 0.55);
        const forwardStep = Math.min(SPEEDSTER_BLOCK_FORWARD_STEP, SPEEDSTER_BLOCK_NUDGE + 1.5);
        racer.x += Math.cos(racer.heading) * forwardStep;
        racer.y += Math.sin(racer.heading) * forwardStep;
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed *= 0.96;
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      } else if (racer.typeId === CROSS_ACCEL_SNAKE_ID) {
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed = Math.min(racer.speed * 1.08, racer.stats.maxSpeed * 1.18);
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      } else {
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed *= BODY_CROSS_SLOWDOWN_MUL;
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      }
      break;
    }
  }
}


export { applyBodyCrossingRules };
