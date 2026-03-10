function serializePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    classType: player.classType,
    x: player.x,
    y: player.y,
    hp: player.hp,
    maxHp: player.maxHp
  };
}

function serializeMob(mob) {
  return {
    id: mob.id,
    name: mob.type || "Mob",
    renderStyle: mob.renderStyle || null,
    x: mob.x,
    y: mob.y,
    hp: mob.hp,
    maxHp: mob.maxHp
  };
}

function serializeLootBag(bag) {
  return {
    id: bag.id,
    x: bag.x,
    y: bag.y
  };
}

module.exports = {
  serializePlayer,
  serializeMob,
  serializeLootBag
};
