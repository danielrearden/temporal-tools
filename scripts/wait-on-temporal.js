/**
 * Copied from https://github.com/temporalio/sdk-typescript/blob/737eb923c37fbfb23e99d7ea9f585c5090ac16f5/scripts/wait-on-temporal.mjs
 */
import { Connection } from "@temporalio/client";

const maxAttempts = 100;
const retryIntervalSecs = 1;
const runId = "26323773-ab30-4442-9a20-c5640b31a7a3";

try {
  for (let attempt = 1; attempt <= maxAttempts; ++attempt) {
    try {
      const client = await Connection.connect();
      // Workaround for describeNamespace returning even though namespace is not registered yet
      // See: https://github.com/temporalio/temporal/issues/1336
      await client.workflowService.getWorkflowExecutionHistory({
        namespace: "default",
        execution: { workflowId: "fake", runId },
      });
    } catch (err) {
      if (
        err.details &&
        (err.details.includes("workflow history not found") ||
          err.details.includes("Workflow executionsRow not found") ||
          err.details.includes("operation GetCurrentExecution") ||
          err.details.includes("operation GetWorkflowExecution encountered not found") ||
          err.details.includes(runId))
      ) {
        break;
      }
      if (attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, retryIntervalSecs * 1000));
    }
  }
} catch (err) {
  console.error("Failed to connect", err);
  process.exit(1);
}

console.log("Connected");
process.exit(0);
