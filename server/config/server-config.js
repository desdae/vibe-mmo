const fs = require("fs");
const { parseMultiplier, parseGameplayInt } = require("../gameplay/number-utils");

function buildServerConfig(parsed) {
  return {
    expMultiplier: parseMultiplier(parsed?.expMultiplier, 1),
    mobHealthMultiplier: parseMultiplier(parsed?.mobHealthMultiplier, 1),
    mobDamageMultiplier: parseMultiplier(parsed?.mobDamageMultiplier, 1),
    mobSpeedMultiplier: parseMultiplier(parsed?.mobSpeedMultiplier, 1),
    mobRespawnMultiplier: parseMultiplier(parsed?.mobRespawnMultiplier, 1),
    dropChanceMultiplier: parseMultiplier(parsed?.dropChanceMultiplier ?? parsed?.dropchanceMultiplier, 1),
    mobSpawnMultiplier: parseMultiplier(parsed?.mobSpawnMultiplier, 1),
    wsConnectionRateLimitWindowMs: parseGameplayInt(parsed?.wsConnectionRateLimitWindowMs, 30000, 1000, 600000),
    wsConnectionRateLimitMax: parseGameplayInt(parsed?.wsConnectionRateLimitMax, 12, 1, 1000),
    wsMessageRateLimitWindowMs: parseGameplayInt(parsed?.wsMessageRateLimitWindowMs, 1000, 100, 60000),
    wsMessageRateLimitMax: parseGameplayInt(parsed?.wsMessageRateLimitMax, 120, 10, 5000)
  };
}

function loadServerConfigFromDisk(configPath) {
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("server config root must be an object");
  }
  return buildServerConfig(parsed);
}

function formatServerConfigForLog(config) {
  return [
    `expMultiplier=${config.expMultiplier}`,
    `mobHealthMultiplier=${config.mobHealthMultiplier}`,
    `mobDamageMultiplier=${config.mobDamageMultiplier}`,
    `mobSpeedMultiplier=${config.mobSpeedMultiplier}`,
    `mobRespawnMultiplier=${config.mobRespawnMultiplier}`,
    `dropChanceMultiplier=${config.dropChanceMultiplier}`,
    `mobSpawnMultiplier=${config.mobSpawnMultiplier}`,
    `wsConnectionRateLimitWindowMs=${config.wsConnectionRateLimitWindowMs}`,
    `wsConnectionRateLimitMax=${config.wsConnectionRateLimitMax}`,
    `wsMessageRateLimitWindowMs=${config.wsMessageRateLimitWindowMs}`,
    `wsMessageRateLimitMax=${config.wsMessageRateLimitMax}`
  ].join(", ");
}

module.exports = {
  buildServerConfig,
  loadServerConfigFromDisk,
  formatServerConfigForLog
};
