import { createHash } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 5000;

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function uuidFromString(source) {
  const hex = createHash("sha1").update(String(source)).digest("hex");
  const base = hex.slice(0, 32).split("");
  base[12] = "5"; // version 5 style UUID.
  const variant = Number.parseInt(base[16], 16);
  base[16] = ((variant & 0x3) | 0x8).toString(16);
  const compact = base.join("");
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20, 32),
  ].join("-");
}

function toOwnerId(userId) {
  if (isUuid(userId)) {
    return String(userId).toLowerCase();
  }
  return uuidFromString(userId);
}

function toUsername(userId, metadata = {}) {
  const candidate = metadata.player_name || userId;
  const value = String(candidate || "snake-player").trim();
  if (!value) {
    return "snake-player";
  }
  return value.slice(0, 64);
}

export function createNakamaClient() {
  const baseUrl = (process.env.NAKAMA_URL || "").replace(/\/$/, "");
  const httpKey = process.env.NAKAMA_HTTP_KEY || "";
  const rpcId = process.env.NAKAMA_RPC_ID || "submit_race_time";

  const enabled = baseUrl.length > 0 && httpKey.length > 0;

  async function submitRaceTime({ userId, trackId, timeMs, metadata = {} }) {
    if (!enabled) {
      return { ok: false, skipped: true, reason: "nakama_client_disabled" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const leaderboardId = `track_${trackId}_time`;
    const url = `${baseUrl}/v2/rpc/${encodeURIComponent(rpcId)}?http_key=${encodeURIComponent(httpKey)}`;
    const ownerId = toOwnerId(userId);
    const username = toUsername(userId, metadata);

    const payload = {
      owner_id: ownerId,
      user_id: String(userId),
      username,
      leaderboard_id: leaderboardId,
      track_id: String(trackId),
      score: Math.max(0, Math.floor(timeMs)),
      metadata,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Nakama HTTP RPC expects a JSON string payload, not a plain JSON object.
        body: JSON.stringify(JSON.stringify(payload)),
        signal: controller.signal,
      });

      const text = await response.text();
      const body = parseJsonSafe(text);

      if (!response.ok) {
        return {
          ok: false,
          skipped: false,
          status: response.status,
          body,
        };
      }

      return { ok: true, skipped: false, body };
    } catch (error) {
      return {
        ok: false,
        skipped: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled,
    baseUrl,
    rpcId,
    submitRaceTime,
  };
}
