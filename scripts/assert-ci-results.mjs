import { readFileSync } from "node:fs";
const [kind, path] = process.argv.slice(2);
const result = JSON.parse(readFileSync(path, "utf8"));
if (kind === "unit") {
  if (
    !result.success ||
    !result.numTotalTests ||
    result.numPendingTests ||
    result.numTodoTests
  )
    throw new Error(
      "CI requires passing unit/integration tests with zero skips",
    );
} else if (kind === "browser") {
  if (
    !result.stats.expected ||
    result.stats.unexpected ||
    result.stats.skipped ||
    result.stats.flaky
  )
    throw new Error(
      "CI requires passing browser tests with zero skips or retries",
    );
} else throw new Error("Unknown CI result type");
