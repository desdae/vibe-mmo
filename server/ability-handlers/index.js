const melee = require("./melee");
const projectile = require("./projectile");
const area = require("./area");
const beam = require("./beam");
const teleport = require("./teleport");

const handlersByKind = new Map([
  ["meleeCone", melee],
  ["projectile", projectile],
  ["area", area],
  ["beam", beam],
  ["teleport", teleport]
]);

function getAbilityHandler(kind) {
  const normalizedKind = String(kind || "");
  return handlersByKind.get(normalizedKind) || handlersByKind.get("meleeCone");
}

function executeAbilityByKind(payload) {
  const handler = getAbilityHandler(payload?.abilityDef?.kind);
  return handler(payload);
}

module.exports = {
  handlersByKind,
  getAbilityHandler,
  executeAbilityByKind
};

