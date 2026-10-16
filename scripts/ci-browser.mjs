import { spawn } from "node:child_process";
import { cpSync } from "node:fs";
const children = [];
const start = (command, args, env = process.env) => {
  const child = spawn(command, args, { stdio: "inherit", env });
  children.push(child);
  return child;
};
const stop = () => children.forEach((child) => child.kill("SIGTERM"));
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stop();
    process.exit(1);
  });
try {
  // Exercise the same standalone layout used by the production container.
  cpSync("public", ".next/standalone/public", { recursive: true });
  cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
  start("node", [".next/standalone/server.js"], {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    PORT: "3000",
  });
  start("node", ["scripts/preview-proxy.mjs"]);
  const deadline = Date.now() + 60_000;
  for (const origin of [process.env.BASE_URL, process.env.PREVIEW_BASE_URL]) {
    while (true) {
      try {
        const response = await fetch(new URL("/api/health", origin), {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) break;
      } catch {
        /* server is starting */
      }
      if (Date.now() >= deadline)
        throw new Error("Production browser server did not become ready");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const tests = start(
    "node",
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--reporter=list,json",
      "--max-failures=1",
    ],
    {
      ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_FILE: "test-results/browser.json",
    },
  );
  process.exitCode = await new Promise((resolve) => {
    tests.on("error", () => resolve(1));
    tests.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  stop();
}
