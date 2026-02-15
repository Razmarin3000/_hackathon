import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./config.js";
import { BODY_ITEMS, PICKUP_TYPES } from "./catalog.js";
import { hexToInt } from "./utils.js";

export function drawBackground(g) {
  g.clear();
  // Grass base with warmer tint for a more natural terrain look.
  g.fillGradientStyle(0x264827, 0x264827, 0x1d381f, 0x1d381f, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  g.fillStyle(0x335d2f, 0.22);
  g.fillEllipse(CANVAS_WIDTH * 0.24, CANVAS_HEIGHT * 0.2, 360, 240);
  g.fillEllipse(CANVAS_WIDTH * 0.74, CANVAS_HEIGHT * 0.25, 300, 220);
  g.fillEllipse(CANVAS_WIDTH * 0.62, CANVAS_HEIGHT * 0.74, 420, 260);
  g.fillStyle(0x1a311a, 0.18);
  g.fillEllipse(CANVAS_WIDTH * 0.45, CANVAS_HEIGHT * 0.46, 300, 170);
}

export function drawRaceWorld(g, race) {
  drawTrack(g, race.track);
  drawCheckpoints(g, race.track);
  drawBodyItems(g, race.bodyItems);
  drawPickups(g, race.pickups);
  drawVenomShots(g, race.venomShots || []);
}

function drawTrack(g, track) {
  // Outer verge (grass shoulder).
  g.lineStyle((track.outsideWidth + 16) * 2, 0x3f6d33, 0.38);
  strokeClosedPolyline(g, track.points);

  // Dirt layer between grass and asphalt.
  g.lineStyle(track.outsideWidth * 2, 0x8d6c45, 0.78);
  strokeClosedPolyline(g, track.points);

  // Dusty edge to soften transition into asphalt.
  g.lineStyle((track.roadWidth + 6) * 2, 0x8f7d61, 0.34);
  strokeClosedPolyline(g, track.points);

  // Asphalt.
  g.lineStyle(track.roadWidth * 2, 0x5c5d59, 0.95);
  strokeClosedPolyline(g, track.points);

  // Center marking.
  g.lineStyle(2, 0xf2dc9a, 0.76);
  drawDashedPolyline(g, track.points, 11, 11);
}

function strokeClosedPolyline(g, points) {
  if (!points.length) {
    return;
  }
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.lineTo(points[0].x, points[0].y);
  g.strokePath();
}

function drawDashedPolyline(g, points, dash, gap) {
  if (points.length < 2) {
    return;
  }
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      continue;
    }
    const nx = dx / len;
    const ny = dy / len;
    let pos = 0;
    let paint = true;
    while (pos < len) {
      const segLen = Math.min(paint ? dash : gap, len - pos);
      if (paint) {
        const x1 = a.x + nx * pos;
        const y1 = a.y + ny * pos;
        const x2 = a.x + nx * (pos + segLen);
        const y2 = a.y + ny * (pos + segLen);
        g.lineBetween(x1, y1, x2, y2);
      }
      pos += segLen;
      paint = !paint;
    }
  }
}

function drawCheckpoints(g, track) {
  for (let i = 0; i < track.checkpoints.length; i += 1) {
    const cp = track.checkpoints[i];
    g.fillStyle(i === 0 ? 0xff6565 : 0x62dbff, i === 0 ? 0.9 : 0.85);
    g.fillCircle(cp.x, cp.y, i === 0 ? 8 : 6);
  }
}

function drawBodyItems(g, bodyItems) {
  for (const item of bodyItems) {
    if (!item.active) {
      continue;
    }
    if (item.type === "APPLE") {
      drawApple(g, item.x, item.y, item.radius);
    } else {
      drawCactus(g, item.x, item.y, item.radius);
    }
  }
}

function drawApple(g, x, y, radius) {
  g.fillStyle(hexToInt(BODY_ITEMS.APPLE.color), 0.95);
  g.fillCircle(x, y, radius * 0.9);
  g.fillStyle(0x8d2e35, 0.34);
  g.fillCircle(x + radius * 0.28, y - radius * 0.1, radius * 0.28);
  g.lineStyle(2, 0x6b4a2d, 1);
  g.lineBetween(x, y - radius, x + 2, y - radius - 7);
  g.fillStyle(0x67d275, 0.95);
  g.fillEllipse(x + 6, y - radius - 6, 8, 5);
}

function drawCactus(g, x, y, radius) {
  const color = hexToInt(BODY_ITEMS.CACTUS.color);
  const h = radius * 1.8;
  const arm = radius * 0.9;
  g.fillStyle(color, 0.95);
  g.fillRoundedRect(x - radius * 0.35, y - h * 0.5, radius * 0.7, h, 3);
  g.fillRoundedRect(x - arm, y - h * 0.2, arm * 0.65, radius * 0.5, 3);
  g.fillRoundedRect(x + radius * 0.35, y - h * 0.06, arm * 0.65, radius * 0.5, 3);
  g.lineStyle(1, 0x2f874f, 0.95);
  g.lineBetween(x - radius * 0.12, y - h * 0.45, x - radius * 0.12, y + h * 0.43);
  g.lineBetween(x + radius * 0.12, y - h * 0.45, x + radius * 0.12, y + h * 0.43);
}

function drawPickups(g, pickups) {
  for (const pickup of pickups) {
    if (!pickup.active) {
      continue;
    }
    const color = hexToInt(PICKUP_TYPES[pickup.type].color);
    const size = 7;
    g.fillStyle(color, 1);
    g.fillPoints(
      [
        { x: pickup.x, y: pickup.y - size },
        { x: pickup.x + size, y: pickup.y },
        { x: pickup.x, y: pickup.y + size },
        { x: pickup.x - size, y: pickup.y },
      ],
      true
    );
  }
}

function drawVenomShots(g, venomShots) {
  for (const shot of venomShots) {
    const base = shot.color || 0x8df36a;
    g.fillStyle(base, 0.88);
    g.fillCircle(shot.x, shot.y, shot.radius);
    g.lineStyle(1, 0xeaffdf, 0.78);
    g.strokeCircle(shot.x, shot.y, shot.radius + 1.8);
  }
}
