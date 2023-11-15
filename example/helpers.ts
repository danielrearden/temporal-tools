import { createWorkerHelpers } from "../src/worker.js";
import { Configuration } from "./configuration.js";
import { ActivityContext } from "./types.js";

export const { createActivities, createActivityFactory, createSink, createWorker } =
  createWorkerHelpers<Configuration, ActivityContext>();
