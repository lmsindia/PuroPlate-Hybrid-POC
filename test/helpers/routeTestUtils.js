const http = require("http");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const { normalizeHttpError } = require("../../utils/errorMapping");

const ROOT_DIR = path.resolve(__dirname, "..", "..");

function resolveModule(relativePath) {
  return require.resolve(path.join(ROOT_DIR, relativePath));
}

function installMock(relativePath, exports) {
  const resolvedPath = resolveModule(relativePath);

  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports
  };
}

function clearModules(relativePaths) {
  for (const relativePath of relativePaths) {
    delete require.cache[resolveModule(relativePath)];
  }
}

async function startRouteServer(routePath, mountPath, mocks = {}) {
  const mockPaths = Object.keys(mocks);
  const modulesToClear = [routePath, ...mockPaths];

  clearModules(modulesToClear);

  for (const [modulePath, exports] of Object.entries(mocks)) {
    installMock(modulePath, exports);
  }

  const router = require(resolveModule(routePath));
  const app = express();

  app.use(bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  }));

  app.use((req, res, next) => {
    req.requestId = "test-request-id";
    req.log = {
      info() {},
      warn() {},
      error() {}
    };
    next();
  });

  app.use(mountPath, router);

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    const { statusCode, clientMessage } = normalizeHttpError(err);

    res.status(statusCode).json({
      error: clientMessage,
      requestId: req.requestId
    });
  });

  const server = await new Promise(resolve => {
    const instance = app.listen(0, () => resolve(instance));
  });

  return {
    async close() {
      await new Promise((resolve, reject) => {
        server.close(err => {
          if (err) {
            reject(err);
            return;
          }

          resolve();
        });
      });

      clearModules(modulesToClear);
    },
    request(options) {
      return sendRequest(server, options);
    }
  };
}

function sendRequest(server, options) {
  const body =
    options.body === undefined ? undefined : JSON.stringify(options.body);

  const headers = {
    ...(options.headers || {})
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: server.address().port,
      path: options.path,
      method: options.method || "GET",
      headers
    }, res => {
      let raw = "";

      res.on("data", chunk => {
        raw += chunk;
      });

      res.on("end", () => {
        const contentType = res.headers["content-type"] || "";
        let parsedBody = null;

        if (raw) {
          if (contentType.includes("application/json")) {
            parsedBody = JSON.parse(raw);
          } else {
            parsedBody = raw;
          }
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody
        });
      });
    });

    req.on("error", reject);

    if (body !== undefined) {
      req.write(body);
    }

    req.end();
  });
}

module.exports = {
  startRouteServer
};
