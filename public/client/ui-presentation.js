(function initVibeClientUiPresentation(globalScope) {
  "use strict";

  function createUiPresentationTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const ctx = deps.ctx;
    const canvas = deps.canvas;
    if (!ctx || !canvas) {
      return null;
    }

    function drawMobTooltip(mob, p) {
      const name = String(mob.name || "Mob");
      const level = Math.max(1, Math.floor(Number(mob.level) || 1));
      const label = `${name} [${level}]`;
      ctx.font = "12px Segoe UI";
      ctx.textAlign = "center";
      const paddingX = 8;
      const height = 22;
      const width = Math.ceil(ctx.measureText(label).width) + paddingX * 2;
      const centerX = deps.clamp(Math.round(p.x), width / 2 + 4, canvas.width - width / 2 - 4);
      const x = Math.round(centerX - width / 2);
      const y = Math.max(4, Math.round(p.y - deps.mobRenderRadius - 38));

      ctx.fillStyle = "rgba(8, 12, 18, 0.88)";
      deps.drawRoundedRect(ctx, x, y, width, height, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(184, 212, 236, 0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#eaf6ff";
      ctx.fillText(label, centerX, y + 15);
    }

    function drawLootBagTooltip(bag, p) {
      const lines = ["Loot Bag"];
      const items = Array.isArray(bag.items) ? bag.items : [];
      if (!items.length) {
        lines.push("(empty)");
      } else {
        for (const entry of items) {
          if (!entry) {
            continue;
          }
          const itemId = String(entry.itemId || "");
          const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
          if (!itemId || qty <= 0) {
            continue;
          }
          const itemDef = deps.itemDefsById.get(itemId);
          lines.push(`${(itemDef && itemDef.name) || String(entry.name || itemId)} x${qty}`);
        }
      }

      ctx.font = "12px Segoe UI";
      ctx.textAlign = "left";
      const paddingX = 8;
      const lineHeight = 15;
      let width = 90;
      for (const line of lines) {
        width = Math.max(width, Math.ceil(ctx.measureText(line).width) + paddingX * 2);
      }

      const height = 8 + lines.length * lineHeight;
      const x = deps.clamp(Math.round(p.x + 12), 4, Math.max(4, canvas.width - width - 4));
      const y = deps.clamp(Math.round(p.y - height - 8), 4, Math.max(4, canvas.height - height - 4));

      ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
      deps.drawRoundedRect(ctx, x, y, width, height, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(184, 212, 236, 0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();

      for (let i = 0; i < lines.length; i += 1) {
        ctx.fillStyle = i === 0 ? "#f6e8be" : "#eaf6ff";
        ctx.fillText(lines[i], x + paddingX, y + 14 + i * lineHeight);
      }
    }

    function drawResourceTooltip(node, p) {
      const lines = [
        String(node && node.name || "Resource"),
        `${String(node && node.skillId || "skill")} ${Math.max(1, Math.floor(Number(node && node.requiredLevel) || 1))}+`
      ];
      const items = Array.isArray(node && node.items) ? node.items : [];
      for (const entry of items) {
        if (!entry) {
          continue;
        }
        const qty = Math.max(0, Math.floor(Number(entry.qty) || 0));
        const name = String(entry.name || entry.itemId || "").trim();
        if (!qty || !name) {
          continue;
        }
        lines.push(`${name} x${qty}`);
      }

      ctx.font = "12px Segoe UI";
      ctx.textAlign = "left";
      const paddingX = 8;
      const lineHeight = 15;
      let width = 108;
      for (const line of lines) {
        width = Math.max(width, Math.ceil(ctx.measureText(line).width) + paddingX * 2);
      }

      const height = 8 + lines.length * lineHeight;
      const x = deps.clamp(Math.round(p.x + 12), 4, Math.max(4, canvas.width - width - 4));
      const y = deps.clamp(Math.round(p.y - height - 8), 4, Math.max(4, canvas.height - height - 4));

      ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
      deps.drawRoundedRect(ctx, x, y, width, height, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(184, 212, 236, 0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();

      for (let i = 0; i < lines.length; i += 1) {
        ctx.fillStyle = i === 0 ? "#dff4ca" : i === 1 ? "#a8d48c" : "#eaf6ff";
        ctx.fillText(lines[i], x + paddingX, y + 14 + i * lineHeight);
      }
    }

    return {
      drawMobTooltip,
      drawLootBagTooltip,
      drawResourceTooltip
    };
  }

  globalScope.VibeClientUiPresentation = Object.freeze({
    createUiPresentationTools
  });
})(globalThis);
