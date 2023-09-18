import { condition } from "@temporalio/workflow";
import { createWorkflowHelpers } from "../src/workflow.js";
import { configuration } from "./configuration.js";

const { createWorkflow, proxyActivities, executeChild, proxySinks } =
  createWorkflowHelpers(configuration);

const { sayHello } = proxyActivities({
  scheduleToCloseTimeout: "5m",
});

const { analytics } = proxySinks();

/**
 * This Workflow demonstrates calling an activity.
 */
export const helloWorld = createWorkflow("helloWorld", async ({ name }) => {
  return await sayHello({ name });
});

/**
 * This is a simple Workflow that does not call any activities.
 */
export const increment = createWorkflow("increment", async ({ initialValue }) => {
  return initialValue + 1;
});

/**
 * This Workflow demonstrates using a custom type serialized using the CustomPayloadConverter.
 */
export const bigIncrement = createWorkflow("bigIncrement", async ({ initialValue }) => {
  return initialValue + 1n;
});

/**
 * This Workflow demonstrates executing a child Workflow.
 */
export const parent = createWorkflow("parent", async ({ value }) => {
  const newValue = await executeChild("child", { args: [{ value }] });
  return newValue;
});

/**
 * Workflow executed by the `parent` Workflow.
 */
export const child = createWorkflow("child", async ({ value }) => {
  return value * 2;
});

/**
 * This Workflow demonstrates using a Sink.
 */
export const heartbeat = createWorkflow("heartbeat", async () => {
  await analytics.addEvent({ message: "thump" });

  return "thump";
});

/**
 * This Workflow demonstrates using Queries and Signals.
 */
export const counter = createWorkflow(
  "counter",
  async ({ initialValue }, { setQueryHandler, setSignalHandler }) => {
    let count = initialValue;

    setQueryHandler("get", () => {
      return count;
    });

    setSignalHandler("increment", ({ delta }) => {
      count += delta;
    });

    await condition(() => false);
  },
);

/**
 * This Workflow demonstrates using Scoped Activities.
 */
export const scoped = createWorkflow("scoped", async ({ proxyScopedActivities }) => {
  const { doSomething } = proxyScopedActivities({
    startToCloseTimeout: "5m",
  });

  return doSomething();
});

/**
 * This Workflow demonstrates using `createSafeAsyncIterable`.
 */
export const safeIterable = createWorkflow(
  "safeIterable",
  async ({ list }, { createSafeAsyncIterable }) => {
    const safeList = createSafeAsyncIterable(
      list,
      (_, lastIndex) => {
        return [{ list: list.slice(lastIndex + 1) }];
      },
      {
        maxHistoryEvents: 30,
      },
    );

    for await (const item of safeList) {
      await sayHello({ name: String(item) });
    }
  },
);
