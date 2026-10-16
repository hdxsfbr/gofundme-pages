import { defineRailway, project, service, preserve } from "railway/iac";

export const partial = "web-runtime";
export default defineRailway((context) =>
  project(context.projectName, {
    resources: [
      service("web", {
        env: {
          AI_MODEL: preserve(),
          AI_REQUEST_BUDGET: preserve(),
          APP_ORIGIN: preserve(),
          DATABASE_URL: preserve(),
          HOSTNAME: preserve(),
          NEXT_TELEMETRY_DISABLED: preserve(),
          NODE_ENV: preserve(),
          OPENAI_API_KEY: preserve(),
          PORT: preserve(),
        },
        build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
        start: "node server.js",
        preDeploy: "node scripts/migrate.mjs",
        healthcheck: "/api/health",
        healthcheckTimeout: 120,
        replicas: 1,
        deploy: {
          preDeployTimeoutSeconds: 75,
          restartPolicyMaxRetries: 3,
        },
      }),
    ],
  }),
);
