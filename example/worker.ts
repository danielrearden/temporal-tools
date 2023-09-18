import { createRequire } from "node:module";
import { createActivities, createWorker } from "./helpers.js";
import * as factories from "./activities.js";
import * as sinks from "./sinks.js";

const context = { logger: console };
const activities = createActivities(context, factories);
const worker = await createWorker({
  dataConverter: {
    payloadConverterPath: createRequire(import.meta.url).resolve("./payloadConverter.ts"),
  },
  sinks,
  taskQueue: "high-priority",
  activities,
  workflowsPath: createRequire(import.meta.url).resolve("./workflows"),
});

await worker.run();
