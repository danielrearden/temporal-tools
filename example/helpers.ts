import { createWorkerHelpers } from "../src/worker.js";
import { type Configuration, configuration } from "./configuration.js";
import { type ActivityContext } from "./types.js";

export const { createActivities, createActivityFactory, createSink, createWorker } =
  createWorkerHelpers<Configuration, ActivityContext>(configuration);
