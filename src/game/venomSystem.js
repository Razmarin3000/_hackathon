import {
  VENOM_PROJECTILE_RADIUS,
  VENOM_PROJECTILE_SPEED,
  VENOM_PROJECTILE_HIT_RADIUS,
  VENOM_PROJECTILE_MAX_LIFE_MS,
  VENOM_SLOW_BASE_DURATION_MS,
} from "./config.js";
import { clamp, sqrDistance, hexToInt } from "./utils.js";
import { projectOnTrack } from "./trackMath.js";

export function createVenomSystemApi({ addEffect, removeEffect } = {}) {
  function getVenomConfig(racer) {
    const base = racer.venomConfig || {};
    return {
      range: clamp(base.range ?? 150, 90, 260),
      cooldownMs: clamp(base.cooldownMs ?? 2400, 900, 6000),
      slowMul: clamp(base.slowMul ?? 0.86, 0.65, 0.95),
      durationMs: clamp(base.durationMs ?? VENOM_SLOW_BASE_DURATION_MS, 800, 4200),
      speed: clamp(base.speed ?? VENOM_PROJECTILE_SPEED, 240, 520),
    };
  }

  function canNpcShootVenom(race, racer, nowMs) {
    if (racer.finished || race.phase !== "running") {
      return false;
    }
    if (racer.speed < 18 || race.racers.length < 2) {
      return false;
    }
    if (nowMs < (racer.nextVenomShotAtMs || 0)) {
      return false;
    }
    const venom = getVenomConfig(racer);
    return Boolean(findVenomTarget(race, racer, venom.range));
  }

  function findVenomTarget(race, racer, range) {
    let best = null;
    const lookCos = Math.cos(0.56);
    const hx = Math.cos(racer.heading);
    const hy = Math.sin(racer.heading);

    for (const target of race.racers) {
      if (target.id === racer.id || target.finished) {
        continue;
      }
      const dx = target.x - racer.x;
      const dy = target.y - racer.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range || dist < 4) {
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const facingDot = hx * nx + hy * ny;
      if (facingDot < lookCos) {
        continue;
      }
      const score = dist - facingDot * 16;
      if (!best || score < best.score) {
        best = { target, score };
      }
    }
    return best ? best.target : null;
  }

  function maybeShootVenom(race, racer, control, nowMs) {
    if (!control?.spit || racer.finished || race.phase !== "running") {
      return;
    }
    if (nowMs < (racer.nextVenomShotAtMs || 0)) {
      return;
    }
    const venom = getVenomConfig(racer);
    racer.nextVenomShotAtMs = nowMs + venom.cooldownMs;

    const shot = {
      id: `venom_${racer.id}_${Math.floor(nowMs)}_${Math.floor(Math.random() * 9999)}`,
      ownerId: racer.id,
      x: racer.x + Math.cos(racer.heading) * 13,
      y: racer.y + Math.sin(racer.heading) * 13,
      vx: Math.cos(racer.heading),
      vy: Math.sin(racer.heading),
      speed: venom.speed,
      radius: VENOM_PROJECTILE_RADIUS,
      bornAtMs: nowMs,
      maxLifeMs: VENOM_PROJECTILE_MAX_LIFE_MS,
      maxTravelDist: venom.range,
      traveledDist: 0,
      durationMs: venom.durationMs,
      slowMul: venom.slowMul,
      color: hexToInt(racer.color),
    };

    race.venomShots.push(shot);
  }

  function updateVenomShots(race, nowMs, dt) {
    if (!race.venomShots || !race.venomShots.length) {
      return;
    }

    for (let i = race.venomShots.length - 1; i >= 0; i -= 1) {
      const shot = race.venomShots[i];
      if (nowMs - shot.bornAtMs > shot.maxLifeMs || shot.traveledDist >= shot.maxTravelDist) {
        race.venomShots.splice(i, 1);
        continue;
      }

      const step = shot.speed * dt;
      shot.x += shot.vx * step;
      shot.y += shot.vy * step;
      shot.traveledDist += Math.abs(step);

      const projection = projectOnTrack(race.track, shot.x, shot.y);
      if (!projection || projection.distance > race.track.outsideWidth * 1.15) {
        race.venomShots.splice(i, 1);
        continue;
      }

      let hitTarget = null;
      for (const target of race.racers) {
        if (target.id === shot.ownerId || target.finished) {
          continue;
        }
        if (sqrDistance(shot.x, shot.y, target.x, target.y) <= (shot.radius + VENOM_PROJECTILE_HIT_RADIUS) ** 2) {
          hitTarget = target;
          break;
        }
      }

      if (!hitTarget) {
        continue;
      }

      applyVenomHit(hitTarget, shot, nowMs);
      race.venomShots.splice(i, 1);
    }
  }

  function applyVenomHit(target, shot, nowMs) {
    if (target.shieldCharges > 0) {
      target.shieldCharges -= 1;
      if (typeof removeEffect === "function") {
        removeEffect(target, "SHIELD");
      }
      return;
    }
    if (typeof addEffect === "function") {
      addEffect(target, "VENOM_SLOW", shot.durationMs, nowMs, { speedMul: shot.slowMul });
    }
  }

  return {
    canNpcShootVenom,
    maybeShootVenom,
    updateVenomShots,
  };
}
