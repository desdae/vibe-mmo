function sendJson(ws, payload) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

function sendBinary(ws, buffer) {
  if (ws && ws.readyState === 1) {
    ws.send(buffer);
  }
}

module.exports = {
  sendJson,
  sendBinary
};
