import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const exec = promisify(execFile);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function configuration(env) {
  for (const name of [
    "RAILWAY_TOKEN",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_SERVICE_ID",
    "APP_ORIGIN",
    "CI_COMMIT_SHA",
    "CI_REPOSITORY_URL",
    "CI_PIPELINE_ID",
  ])
    if (!env[name]?.trim())
      throw new Error(`Missing required variable: ${name}`);
  for (const name of [
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_SERVICE_ID",
  ])
    if (!uuid.test(env[name]))
      throw new Error(`${name} must be an explicit UUID`);
  const origin = new URL(env.APP_ORIGIN);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== env.APP_ORIGIN ||
    origin.username ||
    origin.password
  )
    throw new Error("APP_ORIGIN must be a canonical HTTPS origin");
  if (env.CI_COMMIT_BRANCH !== "main" || env.CI_COMMIT_REF_PROTECTED !== "true")
    throw new Error("Deployment requires protected main");
  if (!/^[0-9a-f]{40}$/.test(env.CI_COMMIT_SHA))
    throw new Error("Invalid source SHA");
  return {
    target: [
      "--project",
      env.RAILWAY_PROJECT_ID,
      "--environment",
      env.RAILWAY_ENVIRONMENT_ID,
      "--service",
      env.RAILWAY_SERVICE_ID,
    ],
    origin: origin.origin,
  };
}
export function uploadIdentity(output) {
  // CLI 5.63.1 emits JSON records; only the upload record carries deploymentId.
  const ids = new Set();
  for (const line of output.trim().split(/\r?\n/)) {
    try {
      const record = JSON.parse(line);
      if (uuid.test(record.deploymentId)) ids.add(record.deploymentId);
    } catch {
      /* CLI may include progress lines */
    }
  }
  if (ids.size !== 1)
    throw new Error("Upload did not return one unambiguous deploymentId");
  return [...ids][0];
}
export function releaseStatus(output, id) {
  const releases = JSON.parse(output);
  if (!Array.isArray(releases))
    throw new Error("Invalid deployment list response");
  const release = releases.find((entry) => entry.id === id);
  if (!release) return "WAITING";
  if (
    [
      "SUCCESS",
      "QUEUED",
      "INITIALIZING",
      "WAITING",
      "BUILDING",
      "DEPLOYING",
    ].includes(release.status)
  )
    return release.status;
  throw new Error(`Deployment ${id} ended in ${String(release.status)}`);
}
export async function waitForRelease(
  id,
  list,
  { now = Date.now, sleep = pause, timeout = 18 * 60_000 } = {},
) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    const status = releaseStatus(await list(), id);
    console.log(`Deployment ${id}: ${status}`);
    if (status === "SUCCESS") return;
    await sleep(10_000);
  }
  throw new Error(`Deployment ${id} timed out`);
}
export async function waitForHealth(
  origin,
  id,
  { request = fetch, now = Date.now, sleep = pause, timeout = 120_000 } = {},
) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    try {
      const response = await request(`${origin}/api/health`, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json();
      if (
        response.ok &&
        body.status === "ok" &&
        body.deploymentId === id &&
        !response.headers.has("set-cookie")
      )
        return;
    } catch {
      /* a new release may still be reaching the public edge */
    }
    await sleep(5000);
  }
  throw new Error("HTTPS readiness never matched the uploaded deployment");
}
export async function assertCurrentMain(env, run = exec) {
  let stdout;
  try {
    ({ stdout } = await run(
      "git",
      ["ls-remote", "--exit-code", env.CI_REPOSITORY_URL, "refs/heads/main"],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    ));
  } catch {
    // execFile errors can include authenticated repository URLs: never print them.
    throw new Error("Unable to verify current main head");
  }
  if (stdout.trim().split(/\s+/)[0] !== env.CI_COMMIT_SHA)
    throw new Error("Outdated deployment rejected: main has moved");
}
export async function verifyInfrastructure(env, railway) {
  // Query only non-secret scope fields. Project-token context is authoritative;
  // `railway link` instead requires account-wide workspace discovery.
  const response = JSON.parse(
    await railway([
      "api",
      "query CiDeploymentScope { projectToken { project { id } environment { id } } }",
      "--compact",
    ]),
  );
  const scope = response.data?.projectToken;
  if (
    scope?.project?.id !== env.RAILWAY_PROJECT_ID ||
    scope?.environment?.id !== env.RAILWAY_ENVIRONMENT_ID
  )
    throw new Error(
      "Railway token scope does not match the configured production target",
    );
  await railway(
    [
      "config",
      "plan",
      "--file",
      ".railway/railway.ts",
      "--json",
      "--detailed-exit-code",
    ],
    120_000,
  );
}
export async function deploy(env = process.env) {
  const { target, origin } = configuration(env);
  const railwayEnv = {
    ...env,
    RAILWAY_CALLER: "skill:use-railway@1.7.0",
    RAILWAY_AGENT_SESSION: `ci-${env.CI_PIPELINE_ID}`,
  };
  const railway = async (args, timeout = 60_000) => {
    try {
      return (
        await exec("railway", args, {
          env: railwayEnv,
          timeout,
          maxBuffer: 4 * 1024 * 1024,
        })
      ).stdout;
    } catch (error) {
      if (args[0] === "config" && error.code === 2)
        throw new Error(
          "Infrastructure changes require a separately reviewed plan and apply before deployment",
        );
      throw new Error(
        `Railway ${args[0]} command failed or timed out; inspect the scoped Railway dashboard`,
      );
    }
  };
  if (!(await railway(["--version"])).trim().endsWith("5.63.1"))
    throw new Error("Railway CLI 5.63.1 is required");
  await assertCurrentMain(env);
  await verifyInfrastructure(env, railway);
  await assertCurrentMain(env);
  const id = uploadIdentity(
    await railway(
      [
        "up",
        ...target,
        "--detach",
        "--json",
        "--message",
        `GitLab ${env.CI_COMMIT_SHA} pipeline ${env.CI_PIPELINE_ID}`,
      ],
      180_000,
    ),
  );
  const record = {
    sourceSha: env.CI_COMMIT_SHA,
    pipelineId: env.CI_PIPELINE_ID,
    deploymentId: id,
    origin,
    status: "uploaded",
  };
  writeFileSync(
    "deployment-result.json",
    JSON.stringify(record, null, 2) + "\n",
  );
  await waitForRelease(id, () =>
    railway(["deployment", "list", ...target, "--limit", "100", "--json"]),
  );
  await waitForHealth(origin, id);
  writeFileSync(
    "deployment-result.json",
    JSON.stringify({ ...record, status: "verified" }, null, 2) + "\n",
  );
  console.log(`Verified ${env.CI_COMMIT_SHA}: ${id} at ${origin}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  deploy().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
