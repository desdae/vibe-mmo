const itemValueTools = require("../../public/shared/item-value");

function createVendorTools(options = {}) {
  const townLayout = options.townLayout || null;
  const itemDefs = options.itemDefs;
  const equipmentConfigProvider =
    typeof options.equipmentConfigProvider === "function" ? options.equipmentConfigProvider : () => null;
  const addItemsToInventory =
    typeof options.addItemsToInventory === "function" ? options.addItemsToInventory : () => ({ added: [], leftover: [], changed: false });
  const sendInventoryState = typeof options.sendInventoryState === "function" ? options.sendInventoryState : () => {};
  const syncPlayerCopperFromInventory =
    typeof options.syncPlayerCopperFromInventory === "function" ? options.syncPlayerCopperFromInventory : () => false;
  const sendSelfProgress = typeof options.sendSelfProgress === "function" ? options.sendSelfProgress : () => {};
  const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
  const copperItemId = String(options.copperItemId || "copperCoin").trim() || "copperCoin";
  const getItemCopperValue =
    typeof itemValueTools.getItemCopperValue === "function" ? itemValueTools.getItemCopperValue : () => 0;

  if (!itemDefs || typeof itemDefs.get !== "function") {
    throw new Error("createVendorTools requires itemDefs map");
  }

  function getVendorNpc() {
    return townLayout && townLayout.vendor ? townLayout.vendor : null;
  }

  function isPlayerNearVendor(player, vendorId = null) {
    const vendor = getVendorNpc();
    if (!player || !vendor) {
      return false;
    }
    if (vendorId && String(vendor.id || "") !== String(vendorId || "")) {
      return false;
    }
    const dx = Number(player.x) - (Number(vendor.x) + 0.5);
    const dy = Number(player.y) - (Number(vendor.y) + 0.5);
    return Math.hypot(dx, dy) <= Math.max(0.5, Number(vendor.interactRange) || 2.25);
  }

  function getInventoryEntrySellValue(entry) {
    if (!entry || typeof entry !== "object") {
      return 0;
    }
    if (String(entry.itemId || "") === copperItemId) {
      return 0;
    }
    const equipmentConfig = equipmentConfigProvider() || {};
    return Math.max(
      0,
      Math.round(
        getItemCopperValue(entry, {
          itemDef: itemDefs.get(String(entry.itemId || "")) || null,
          itemRarities: equipmentConfig.itemRarities || equipmentConfig.clientEquipmentConfig?.itemRarities || {}
        })
      )
    );
  }

  function sellInventoryItemToVendor(player, inventoryIndex, vendorId = null) {
    if (!player || !Array.isArray(player.inventorySlots) || !isPlayerNearVendor(player, vendorId)) {
      return { ok: false, message: "You are too far from the vendor." };
    }
    if (!Number.isInteger(inventoryIndex) || inventoryIndex < 0 || inventoryIndex >= player.inventorySlots.length) {
      return { ok: false, message: "Invalid inventory slot." };
    }
    const entry = player.inventorySlots[inventoryIndex];
    if (!entry) {
      return { ok: false, message: "No item in that inventory slot." };
    }
    const saleValue = getInventoryEntrySellValue(entry);
    if (saleValue <= 0) {
      return { ok: false, message: "That item has no vendor value." };
    }

    const removedEntry = player.inventorySlots[inventoryIndex];
    player.inventorySlots[inventoryIndex] = null;
    const transfer = addItemsToInventory(player, [{ itemId: copperItemId, qty: saleValue }]);
    if (!transfer.added.length || transfer.leftover.length) {
      player.inventorySlots[inventoryIndex] = removedEntry;
      return { ok: false, message: "Could not add copper to inventory." };
    }

    if (transfer.changed) {
      sendInventoryState(player);
    }
    syncPlayerCopperFromInventory(player, true);
    sendSelfProgress(player);
    sendJson(player.ws, {
      type: "vendor_sale_result",
      ok: true,
      inventoryIndex,
      copperGained: saleValue,
      itemName: String(removedEntry.name || itemDefs.get(String(removedEntry.itemId || ""))?.name || removedEntry.itemId)
    });
    return {
      ok: true,
      inventoryIndex,
      copperGained: saleValue
    };
  }

  return {
    getVendorNpc,
    isPlayerNearVendor,
    getInventoryEntrySellValue,
    sellInventoryItemToVendor
  };
}

module.exports = {
  createVendorTools
};
