const http = require("http");
const { randomUUID } = require("crypto");

const port = Number(process.env.PORT || 3000);
const instance = process.env.INSTANCE_NAME || "app-local";

function sendJson(res, statusCode, body, headers = {}) {
  const payload = JSON.stringify(body);

  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const found = cookies.find((item) => item.startsWith(`${name}=`));

  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requestId = randomUUID();

  if (url.pathname === "/health") {
    sendJson(res, 200, {
      status: "ok",
      instance,
    });
    return;
  }

  if (url.pathname === "/slow") {
    const ms = Math.min(Number(url.searchParams.get("ms") || 1000), 10000);

    setTimeout(() => {
      sendJson(res, 200, {
        instance,
        requestId,
        delayMs: ms,
        message: "Slow response finished",
      });
    }, ms);
    return;
  }

  if (url.pathname === "/session") {
    const existingSessionId = readCookie(req, "demo_session");
    const sessionId = existingSessionId || randomUUID();

    sendJson(
      res,
      200,
      {
        instance,
        requestId,
        sessionId,
        message: existingSessionId ? "Existing session" : "New session",
      },
      {
        "Set-Cookie": `demo_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly`,
      },
    );
    return;
  }

  sendJson(res, 200, {
    instance,
    requestId,
    message: "Hello from backend",
  });
});

server.listen(port, () => {
  console.log(`${instance} listening on port ${port}`);
});
