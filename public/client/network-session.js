(function initVibeClientNetworkSession(globalScope) {
  "use strict";

  function createNetworkSessionTools(rawDeps) {
    const deps = rawDeps && typeof rawDeps === "object" ? rawDeps : {};
    const addTrafficEvent = typeof deps.addTrafficEvent === "function" ? deps.addTrafficEvent : () => {};
    const byteLengthOfWsData =
      typeof deps.byteLengthOfWsData === "function" ? deps.byteLengthOfWsData : () => 0;
    const parseBinaryPacket =
      typeof deps.parseBinaryPacket === "function" ? deps.parseBinaryPacket : () => {};
    const messageHandlers = deps.messageHandlers && typeof deps.messageHandlers === "object" ? deps.messageHandlers : {};
    const onMalformedJson = typeof deps.onMalformedJson === "function" ? deps.onMalformedJson : () => {};
    const onUnknownMessage = typeof deps.onUnknownMessage === "function" ? deps.onUnknownMessage : () => {};
    const onSocketReady = typeof deps.onSocketReady === "function" ? deps.onSocketReady : () => {};

    function dispatchJsonMessage(msg) {
      if (!msg || typeof msg !== "object") {
        return false;
      }
      const type = String(msg.type || "");
      if (!type) {
        return false;
      }
      const handler = messageHandlers[type];
      if (typeof handler !== "function") {
        onUnknownMessage(msg);
        return false;
      }
      handler(msg);
      return true;
    }

    function createSocketSession(name, classType, isAdmin = false) {
      const protocol = globalScope.location && globalScope.location.protocol === "https:" ? "wss:" : "ws:";
      const host = globalScope.location ? globalScope.location.host : "";
      const wsUrl = `${protocol}//${host}`;
      const socket = new globalScope.WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      onSocketReady(socket);

      socket.addEventListener("open", () => {
        const openHandler = messageHandlers.__open;
        if (typeof openHandler === "function") {
          openHandler({ name, classType, isAdmin: !!isAdmin, socket });
        }
      });

      socket.addEventListener("close", () => {
        const closeHandler = messageHandlers.__close;
        if (typeof closeHandler === "function") {
          closeHandler({ socket });
        }
      });

      socket.addEventListener("message", (event) => {
        addTrafficEvent("down", byteLengthOfWsData(event.data));

        if (event.data instanceof ArrayBuffer) {
          try {
            parseBinaryPacket(event.data);
          } catch (_error) {
            // Ignore malformed binary packets.
          }
          return;
        }

        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (_error) {
          onMalformedJson(event.data);
          return;
        }

        dispatchJsonMessage(msg);
      });

      return socket;
    }

    return {
      dispatchJsonMessage,
      createSocketSession
    };
  }

  globalScope.VibeClientNetworkSession = Object.freeze({
    createNetworkSessionTools
  });
})(globalThis);
