const { buildServerConfig, formatServerConfigForLog } = require("../config/server-config");

describe("server-config", () => {
  test("defaults websocket proxy trust off and payload cap to 64 KiB", () => {
    const config = buildServerConfig({});

    expect(config.wsTrustProxyHeaders).toBe(false);
    expect(config.wsMaxPayloadBytes).toBe(65536);
  });

  test("parses websocket overrides and includes them in logs", () => {
    const config = buildServerConfig({
      wsTrustProxyHeaders: true,
      wsMaxPayloadBytes: 131072
    });

    expect(config.wsTrustProxyHeaders).toBe(true);
    expect(config.wsMaxPayloadBytes).toBe(131072);
    expect(formatServerConfigForLog(config)).toContain("wsTrustProxyHeaders=true");
    expect(formatServerConfigForLog(config)).toContain("wsMaxPayloadBytes=131072");
  });
});
