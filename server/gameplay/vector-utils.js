function normalizeDirection(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (!length) {
    return null;
  }
  return { dx: dx / length, dy: dy / length };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rotateDirection(dir, radians) {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return {
    dx: dir.dx * c - dir.dy * s,
    dy: dir.dx * s + dir.dy * c
  };
}

function steerDirectionTowards(currentDir, desiredDir, maxTurnRadians) {
  const current = normalizeDirection(currentDir.dx, currentDir.dy);
  const desired = normalizeDirection(desiredDir.dx, desiredDir.dy);
  if (!current || !desired) {
    return current || desired || null;
  }
  const maxTurn = Math.max(0, Number(maxTurnRadians) || 0);
  if (maxTurn <= 0) {
    return current;
  }
  const dot = Math.max(-1, Math.min(1, current.dx * desired.dx + current.dy * desired.dy));
  const angle = Math.acos(dot);
  if (!Number.isFinite(angle) || angle <= maxTurn) {
    return desired;
  }
  const t = Math.max(0, Math.min(1, maxTurn / Math.max(0.0001, angle)));
  return (
    normalizeDirection(
      current.dx + (desired.dx - current.dx) * t,
      current.dy + (desired.dy - current.dy) * t
    ) || current
  );
}

module.exports = {
  normalizeDirection,
  distance,
  rotateDirection,
  steerDirectionTowards
};
