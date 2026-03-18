const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { createGameHttpServer } = require("../network/http-server");

function makeTempPublicDir() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibemmo-http-server-"));
  fs.writeFileSync(path.join(tempRoot, "index.html"), "<!doctype html><html><body>ok</body></html>", "utf8");
  return tempRoot;
}

function fetchJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          });
        });
      }
    );
    req.on("error", reject);
  });
}

describe("http-server config endpoints", () => {
  let publicDir;

  beforeEach(() => {
    publicDir = makeTempPublicDir();
  });

  afterEach(() => {
    if (publicDir && fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true });
    }
  });

  test("serves lightweight join config without invoking full game config payload", async () => {
    const getJoinConfigPayload = jest.fn(() => ({
      classes: [{ id: "warrior", name: "Warrior" }]
    }));
    const getGameConfigPayload = jest.fn(() => ({
      classes: [{ id: "mage", name: "Mage" }],
      abilities: []
    }));
    const server = createGameHttpServer({
      http,
      publicDir,
      getJoinConfigPayload,
      getGameConfigPayload,
      indexFileName: "index.html"
    });

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const response = await fetchJson(port, "/api/join-config");

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        classes: [{ id: "warrior", name: "Warrior" }]
      });
      expect(getJoinConfigPayload).toHaveBeenCalledTimes(1);
      expect(getGameConfigPayload).not.toHaveBeenCalled();
      expect(String(response.headers["cache-control"] || "")).toContain("max-age=60");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
