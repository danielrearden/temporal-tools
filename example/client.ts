import { createRequire } from "node:module";
import { setTimeout } from "node:timers/promises";
import { createClient } from "../src/client.js";
import { Configuration } from "./configuration.js";
import { createListFilterQueryBuilder } from "../src/queryBuilder.js";

const client = createClient<Configuration>({
  dataConverter: {
    payloadConverterPath: createRequire(import.meta.url).resolve("./payloadConverter.ts"),
  },
  namespace: "default",
});

try {
  /**
   * Example of executing a simple Workflow.
   */
  const helloWorld = await client.workflow.execute("helloWorld", {
    args: [{ name: "John" }],
    workflowId: "hello",
    taskQueue: "high-priority",
  });
  console.log("helloWorld:", helloWorld);

  /**
   * Example of executing a Workflow that uses a custom type serialized using the CustomPayloadConverter.
   */
  const bigIncrement = await client.workflow.execute("bigIncrement", {
    args: [{ initialValue: 66n }],
    workflowId: "bigIncrement",
    taskQueue: "high-priority",
  });
  console.log("bigIncrement:", bigIncrement);

  /**
   * Example of failed workflow argument validation.
   */
  await client.workflow
    .execute("helloWorld", {
      // @ts-expect-error
      args: [{ name: 99 }],
      workflowId: "hello",
      taskQueue: "high-priority",
    })
    .catch((error) => {
      console.log("failed workflow validation:", error);
    });

  /**
   * Example of using search attributes with a workflow, and creating a List Filter using the `ListFilterQueryBuilder`.
   */
  await client.workflow.execute("helloWorld", {
    args: [{ name: "John" }],
    searchAttributes: {
      CustomIntField: [100],
    },
    workflowId: "searchable",
    taskQueue: "high-priority",
  });

  console.log("Waiting for Temporal to index the Workflow...");
  await setTimeout(10_000);

  const QueryBuilder = createListFilterQueryBuilder<Configuration>();
  const query = new QueryBuilder().where("CustomIntField").eq(100).build();
  const results = client.workflow.list({ query });

  for await (const result of results) {
    console.log("found workflow:", result);
  }

  /**
   * Example of executing a Workflow that uses both a Query and a Signal.
   */
  const counterHandle = await client.workflow.start("counter", {
    args: [{ initialValue: 1 }],
    workflowId: "counter",
    taskQueue: "high-priority",
  });
  let counterValue = await counterHandle.query("get");
  console.log("counterValue:", counterValue);
  await counterHandle.signal("increment", { delta: 1 });
  counterValue = await counterHandle.query("get");
  console.log("counterValue:", counterValue);
  await counterHandle.terminate();

  /**
   * Example of a workflow that uses `createSafeAsyncIterable` to safely iterate over a large list of items.
   */
  const safeIterable = await client.workflow.execute("safeIterable", {
    args: [
      {
        list: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      },
    ],
    workflowId: "safeIterable",
    taskQueue: "high-priority",
  });
} finally {
  await client.connection.close();
}
