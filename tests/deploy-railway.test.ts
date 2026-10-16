import { describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
  assertCurrentMain,
  configuration,
  deploymentEnvironment,
  releaseStatus,
  uploadIdentity,
  waitForHealth,
  waitForRelease,
  verifyInfrastructure,
} from "../scripts/deploy-railway.mjs";
const id = "36160e10-edbc-4ffd-aee0-e3e7d85c39db";
const env = {
  RAILWAY_TOKEN: "fixture-token",
  RAILWAY_PROJECT_ID: id,
  RAILWAY_ENVIRONMENT_ID: id,
  RAILWAY_SERVICE_ID: id,
  APP_ORIGIN: "https://example.test",
  CI_COMMIT_SHA: "a".repeat(40),
  CI_REPOSITORY_URL: "https://credential@example.test/project.git",
  CI_PIPELINE_ID: "123",
  CI_COMMIT_BRANCH: "main",
  CI_COMMIT_REF_PROTECTED: "true",
};
describe("production deployment gate", () => {
  it("requires secrets, explicit targets and protected main", () => {
    expect(configuration(env).target).toContain(id);
    for (const patch of [
      { RAILWAY_TOKEN: "" },
      { RAILWAY_SERVICE_ID: "web" },
      { APP_ORIGIN: "http://example.test" },
      { APP_ORIGIN: "https://example.test/path" },
      { CI_COMMIT_BRANCH: "feature" },
      { CI_COMMIT_REF_PROTECTED: "false" },
    ])
      expect(() => configuration({ ...env, ...patch })).toThrow();
  });
  it("rejects stale jobs and redacts authenticated Git failures", async () => {
    await expect(
      assertCurrentMain(
        env,
        vi.fn().mockResolvedValue({
          stdout: `${env.CI_COMMIT_SHA}\trefs/heads/main`,
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertCurrentMain(
        env,
        vi.fn().mockResolvedValue({ stdout: "b".repeat(40) }),
      ),
    ).rejects.toThrow("Outdated");
    await expect(
      assertCurrentMain(
        env,
        vi.fn().mockRejectedValue(new Error(env.CI_REPOSITORY_URL)),
      ),
    ).rejects.toThrow(/^Unable to verify current main head$/);
  });
  it("requires a unique upload identity", () => {
    expect(
      uploadIdentity(`Uploading\n${JSON.stringify({ deploymentId: id })}`),
    ).toBe(id);
    expect(() => uploadIdentity('{"status":"skipped"}')).toThrow();
    expect(() =>
      uploadIdentity(
        JSON.stringify({ deploymentId: id }) +
          "\n" +
          JSON.stringify({
            deploymentId: "46160e10-edbc-4ffd-aee0-e3e7d85c39db",
          }),
      ),
    ).toThrow();
  });
  it("polls the exact uploaded release and fails terminal states", async () => {
    expect(
      releaseStatus(JSON.stringify([{ id: "other", status: "SUCCESS" }]), id),
    ).toBe("WAITING");
    for (const status of [
      "FAILED",
      "CRASHED",
      "REMOVED",
      "SKIPPED",
      "NEEDS_APPROVAL",
      "UNKNOWN",
    ])
      expect(() => releaseStatus(JSON.stringify([{ id, status }]), id)).toThrow(
        status,
      );
    let time = 0;
    await expect(
      waitForRelease(id, async () => "[]", {
        now: () => time,
        sleep: async (ms: number) => {
          time += ms;
        },
        timeout: 10,
      }),
    ).rejects.toThrow("timed out");
  });
  it("rejects old healthy deployments, cookies, errors and bounded timeouts", async () => {
    for (const response of [
      new Response(JSON.stringify({ status: "ok", deploymentId: "old" })),
      new Response(JSON.stringify({ status: "ok", deploymentId: id }), {
        headers: { "set-cookie": "demo_session=fixture" },
      }),
      new Response("unavailable", { status: 503 }),
    ]) {
      let time = 0;
      await expect(
        waitForHealth(env.APP_ORIGIN, id, {
          request: async () => response.clone(),
          now: () => time,
          sleep: async (ms: number) => {
            time += ms;
          },
          timeout: 10,
        }),
      ).rejects.toThrow("never matched");
    }
    await expect(
      waitForHealth(env.APP_ORIGIN, id, {
        request: async () =>
          new Response(JSON.stringify({ status: "ok", deploymentId: id })),
      }),
    ).resolves.toBeUndefined();
  });
});

describe("reviewed infrastructure gate", () => {
  it("requires exact project-token scope before planning", async () => {
    const railway = vi.fn().mockResolvedValue(
      JSON.stringify({
        data: {
          projectToken: { project: { id: "other" }, environment: { id } },
        },
      }),
    );
    await expect(verifyInfrastructure(env, railway)).rejects.toThrow("scope");
    expect(railway).toHaveBeenCalledTimes(1);
  });
  it("requires a successful read-only zero-diff plan without applying infrastructure", async () => {
    const railway = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          data: { projectToken: { project: { id }, environment: { id } } },
        }),
      )
      .mockResolvedValueOnce("{}");
    await expect(verifyInfrastructure(env, railway)).resolves.toBeUndefined();
    expect(railway.mock.calls[1][0]).toEqual([
      "config",
      "plan",
      "--file",
      ".railway/railway.ts",
      "--json",
      "--detailed-exit-code",
    ]);
    const failing = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          data: { projectToken: { project: { id }, environment: { id } } },
        }),
      )
      .mockRejectedValueOnce(new Error("unreviewed changes"));
    await expect(verifyInfrastructure(env, failing)).rejects.toThrow(
      "unreviewed",
    );
  });
});

describe("SDK CLI compatibility check", () => {
  it("checks the PATH CLI instead of an inherited Node executable during real SDK evaluation", () => {
    const directory = mkdtempSync(join(tmpdir(), "railway-sdk-version-"));
    try {
      // A version-only CLI fixture; importing the real SDK performs no API call.
      writeFileSync(
        join(directory, "railway"),
        '#!/bin/sh\ntest "$1" = "--version" || exit 1\nprintf "railway 5.63.1\\n"\n',
        { mode: 0o700 },
      );
      const source =
        'const mod = await import("railway/iac"); const partial = mod.partial; const graph = {}; process.stdout.write(JSON.stringify({ partial, project: graph }));';
      const args = [
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        source,
      ];
      const inherited = {
        ...process.env,
        ...env,
        _: process.execPath,
        PATH: directory + delimiter + process.env.PATH,
      };
      expect(() =>
        execFileSync(process.execPath, args, { env: inherited, stdio: "pipe" }),
      ).toThrow("requires Railway CLI 5.42.1 or newer");
      const sanitized = deploymentEnvironment(inherited);
      expect(sanitized.RAILWAY_TOKEN).toBe(env.RAILWAY_TOKEN);
      expect(inherited._).toBe(process.execPath);
      expect(
        execFileSync(process.execPath, args, {
          env: sanitized,
          encoding: "utf8",
          stdio: "pipe",
        }),
      ).toBe('{"project":{}}');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
