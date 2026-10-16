// Reproduce a browser-facing local preview port that forwards to Next's port.
// Configure the same origin in APP_PREVIEW_ORIGINS before starting the app.
import http from "node:http";
const target = new URL(process.env.PREVIEW_TARGET || "http://127.0.0.1:3000");
const preview = new URL(
  process.env.PREVIEW_BASE_URL || "http://localhost:61071",
);
if (
  target.protocol !== "http:" ||
  preview.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(preview.hostname)
)
  throw new Error("This helper requires HTTP and a loopback preview address.");
const server = http.createServer((request, response) => {
  const upstream = http.request(
    {
      hostname: target.hostname,
      port: target.port || 80,
      path: request.url,
      method: request.method,
      headers: {
        ...request.headers,
        host: target.host,
        "x-forwarded-host": preview.host,
        "x-forwarded-proto": "http",
      },
    },
    (result) => {
      response.writeHead(result.statusCode || 502, result.headers);
      result.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502);
    response.end("Preview upstream is unavailable.");
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
});
server.listen(Number(preview.port || 80), "127.0.0.1", () => {
  console.log(`Preview reproduction: ${preview.origin} -> ${target.origin}`);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
