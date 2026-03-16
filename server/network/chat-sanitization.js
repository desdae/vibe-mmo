"use strict";

const { MAX_CHAT_MESSAGE_LENGTH } = require("../../config/game-constants");

function collapseWhitespace(value) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeChatText(value, maxLength = MAX_CHAT_MESSAGE_LENGTH) {
  const normalizedMaxLength = Math.max(1, Math.floor(Number(maxLength) || MAX_CHAT_MESSAGE_LENGTH));
  const sanitized = collapseWhitespace(
    String(value || "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/[<>]/g, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/\bon[a-z0-9_-]+\s*=/gi, "")
  );
  if (!sanitized) {
    return "";
  }
  return sanitized.slice(0, normalizedMaxLength).trim();
}

function sanitizeChatSender(value, fallback = "Player") {
  const sanitized = sanitizeChatText(value, 24);
  return sanitized || String(fallback || "Player");
}

module.exports = {
  sanitizeChatText,
  sanitizeChatSender
};
