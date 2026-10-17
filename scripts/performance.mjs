import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
const origin = process.env.BASE_URL || "http://127.0.0.1:3000";
const routes = {
  community: "/communities/a-greener-tomorrow",
  watch: "/communities/a-greener-tomorrow/watch",
  fundraiser: "/fundraisers/grow-a-neighborhood",
  profile: "/profiles/maya-chen",
};
const requestedRoutes = process.env.PERFORMANCE_ROUTES?.split(",").map((r) =>
  r.trim(),
);
const routeEntries = Object.entries(routes).filter(
  ([name]) => !requestedRoutes || requestedRoutes.includes(name),
);
if (requestedRoutes?.some((name) => !(name in routes)))
  throw new Error(`Unknown performance route: ${requestedRoutes.join(", ")}`);
const dir = process.env.PERFORMANCE_EVIDENCE_DIR || "docs/evidence/performance";
await mkdir(dir, { recursive: true });
const results = [];
for (const [name, route] of routeEntries) {
  const runs = [];
  for (let i = 1; i <= 3; i++) {
    const chrome = await launch({
      chromePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
      chromeFlags: [
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    try {
      const output = await lighthouse(origin + route, {
        port: chrome.port,
        output: ["json", "html"],
        logLevel: "error",
        onlyCategories: ["performance"],
        extraHeaders: { "x-demo-test": "true" },
      });
      if (!output || output.lhr.runtimeError)
        throw new Error(output?.lhr.runtimeError?.message || "No report");
      await writeFile(`${dir}/${name}-${i}.json`, output.report[0]);
      await writeFile(`${dir}/${name}-${i}.html`, output.report[1]);
      const metrics = {
        run: i,
        lcpMs: output.lhr.audits["largest-contentful-paint"].numericValue,
        observedLcpMs:
          output.lhr.audits.metrics.details.items[0]
            .observedLargestContentfulPaint,
        cls: output.lhr.audits["cumulative-layout-shift"].numericValue,
        score: output.lhr.categories.performance.score,
      };
      runs.push(metrics);
      console.log(name + " " + JSON.stringify(metrics));
      if (results.length === 0 && i === 1)
        await writeFile(
          `${dir}/settings.json`,
          JSON.stringify(output.lhr.configSettings, null, 2) + "\n",
        );
    } finally {
      await chrome.kill();
    }
  }
  const median = (key) => runs.map((r) => r[key]).sort((a, b) => a - b)[1];
  results.push({
    name,
    route,
    runs,
    medianLcpMs: median("lcpMs"),
    medianObservedLcpMs: median("observedLcpMs"),
    medianCls: median("cls"),
    pass: median("lcpMs") <= 2500 && median("cls") <= 0.1,
  });
}
const packageInfo = JSON.parse(
  await readFile("node_modules/lighthouse/package.json", "utf8"),
);
await writeFile(
  `${dir}/summary.json`,
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      tool: "Lighthouse",
      version: packageInfo.version,
      node: process.version,
      os: os.type() + " " + os.release(),
      cpu: os.cpus()[0]?.model,
      ramGiB: Math.round(os.totalmem() / 1024 ** 3),
      build: "Next.js production, npm run build && npm run start",
      buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(),
      method:
        "Three separate Chrome launches per route; fresh temporary browser profiles and Lighthouse storage reset; default simulated mobile preset. Local server and image optimizer may have warm caches. No concurrent browser suite.",
      dataset:
        "One fictional community, four campaigns, fixed seed ledger, new visitor per run; automation tagged x-demo-test.",
      settings: "settings.json",
      results,
    },
    null,
    2,
  ) + "\n",
);
if (results.some((r) => !r.pass)) process.exitCode = 1;
