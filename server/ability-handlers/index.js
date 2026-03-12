const melee = require("./melee");
const projectile = require("./projectile");
const area = require("./area");
const beam = require("./beam");
const chain = require("./chain");
const summon = require("./summon");
const selfBuff = require("./self-buff");
const teleport = require("./teleport");

const handlersByKind = new Map([
  ["meleeCone", melee],
  ["projectile", projectile],
  ["area", area],
  ["beam", beam],
  ["chain", chain],
  ["summon", summon],
  ["selfBuff", selfBuff],
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
