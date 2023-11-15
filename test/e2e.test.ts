import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { WorkflowExecutionInfo, WorkflowFailedError } from "@temporalio/client";
import { Worker } from "@temporalio/worker";
import { createActivities, createWorker } from "../example/helpers.js";
import * as factories from "../example/activities.js";
import * as sinks from "../example/sinks.js";
import { TypedClient } from "../src/types.js";
import { Configuration } from "../example/configuration.js";
import { createClient } from "../src/client.js";
import { createListFilterQueryBuilder } from "../src/queryBuilder.js";
import { retry } from "./utilities.js";

const QueryBuilder = createListFilterQueryBuilder<Configuration>();

let worker: Worker;
let client: TypedClient<Configuration>;

describe("e2e", () => {
  before(async () => {
    const payloadConverterPath = fileURLToPath(
      new URL("../example/payloadConverter.ts", import.meta.url),
    );
    const context = { logger: console };
    const activities = createActivities(context, factories);
    worker = await createWorker({
      dataConverter: { payloadConverterPath },
      namespace: "default",
      sinks,
      taskQueue: "high-priority",
      activities,
      workflowsPath: fileURLToPath(new URL("../example/workflows.ts", import.meta.url)),
    });

    worker.run().catch(console.error);

    client = createClient<Configuration>({
      dataConverter: { payloadConverterPath },
      namespace: "default",
    });
  });

  after(async () => {
    client?.connection.close();
    worker?.shutdown();
  });

  test("execute workflow with no activities", async () => {
    const result = await client.workflow.execute("increment", {
      args: [{ initialValue: 5 }],
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });
    assert.strictEqual(result, 6);
  });

  test("execute workflow with activity", async () => {
    const result = await client.workflow.execute("helloWorld", {
      args: [{ name: "John" }],
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });
    assert.strictEqual(result, "Hello, John!");
  });

  test("argument validation", async () => {
    try {
      const result = await client.workflow.execute("helloWorld", {
        // @ts-expect-error
        args: [{ name: 42 }],
        workflowId: randomUUID(),
        taskQueue: "high-priority",
      });
      assert.fail(`Expected to throw, got ${result}`);
    } catch (err) {
      if (err instanceof WorkflowFailedError) {
        assert.strictEqual(
          err.cause?.message,
          "Invalid workflow arguments:\n  args[0].name: Expected string, received number",
        );
      } else {
        assert.fail(`Expected WorkflowFailedError, got ${err}`);
      }
    }
  });

  test("execute workflow with child workflow", async () => {
    const result = await client.workflow.execute("parent", {
      args: [{ value: 3 }],
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });
    assert.strictEqual(result, 6);
  });

  test("execute workflow with custom type", async () => {
    const result = await client.workflow.execute("bigIncrement", {
      args: [{ initialValue: 66n }],
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });
    assert.strictEqual(result, 67n);
  });

  test("execute workflow with scoped activity", async () => {
    const result = await client.workflow.execute("scoped", {
      args: [],
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });
    assert.strictEqual(result, 42);
  });

  test("execute workflow with sink", async () => {
    const result = await client.workflow.execute("heartbeat", {
      args: [],
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });
    assert.strictEqual(result, "thump");
  });

  test("execute workflow with query and signal", async () => {
    const handle = await client.workflow.start("counter", {
      args: [{ initialValue: 1 }],
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });
    let result = await handle.query("get");
    assert.strictEqual(result, 1);
    await handle.signal("increment", { delta: 1 });
    result = await handle.query("get");
    assert.strictEqual(result, 2);
    await handle.terminate();
  });

  test("execute workflow with search attributes", async () => {
    const workflowId = randomUUID();
    const startTime = new Date();

    await client.workflow.execute("helloWorld", {
      args: [{ name: "John" }],
      searchAttributes: {
        CustomIntField: [100],
      },
      workflowId,
      taskQueue: "high-priority",
    });
    await client.workflow.execute("helloWorld", {
      args: [{ name: "Bob" }],
      searchAttributes: {
        CustomIntField: [200],
      },
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });

    await retry(async () => {
      const query = new QueryBuilder()
        .where("CustomIntField")
        .eq(100)
        .where("StartTime")
        .gte(startTime)
        .build();
      const results = client.workflow.list({ query });
      const workflows: WorkflowExecutionInfo[] = [];

      for await (const result of results) {
        workflows.push(result);
      }

      assert.strictEqual(workflows.length, 1);
      assert.strictEqual(workflows[0].workflowId, workflowId);
      assert.deepEqual(workflows[0].searchAttributes?.CustomIntField, [100]);
    }, 10_000);
  });

  test("start workflow", async () => {
    const handle = await client.workflow.start("helloWorld", {
      args: [{ name: "Mike" }],
      workflowId: randomUUID(),
      taskQueue: "high-priority",
    });
    const result = await handle.result();
    assert.strictEqual(result, "Hello, Mike!");
  });

  test("execute workflow with createSafeAsyncIterable", async () => {
    const workflowId = randomUUID();
    const startTime = new Date();

    await client.workflow.execute("safeIterable", {
      args: [
        {
          list: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        },
      ],
      workflowId,
      taskQueue: "high-priority",
    });

    await retry(async () => {
      const query = new QueryBuilder()
        .where("WorkflowId")
        .eq(workflowId)
        .where("StartTime")
        .gte(startTime)
        .build();
      const results = client.workflow.list({ query });
      const workflows: WorkflowExecutionInfo[] = [];

      for await (const result of results) {
        workflows.push(result);
      }

      assert.strictEqual(workflows.length, 5);
      assert.strictEqual(workflows[0].status.name, "COMPLETED");
    }, 10_000);
  });
});
