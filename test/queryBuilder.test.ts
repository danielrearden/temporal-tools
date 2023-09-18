import assert from "node:assert";
import { describe, test } from "node:test";
import { configuration } from "../example/configuration.js";
import { createListFilterQueryBuilder } from "../src/queryBuilder.js";

describe("createQueryBuilder", () => {
  const QueryBuilder = createListFilterQueryBuilder(configuration);

  test("generates correct syntax", () => {
    assert.strictEqual(
      new QueryBuilder().where("CustomIntField").eq(42).build(),
      "CustomIntField = 42",
    );

    assert.strictEqual(
      new QueryBuilder()
        .where("WorkflowType")
        .eq("counter")
        .where("WorkflowId")
        .eq("my-id")
        .build(),
      "WorkflowType = 'counter' AND WorkflowId = 'my-id'",
    );

    assert.strictEqual(
      new QueryBuilder()
        .where("WorkflowType")
        .eq("counter")
        .and([
          new QueryBuilder().where("WorkflowId").eq("my-workflow-id"),
          new QueryBuilder().where("RunId").eq("my-run-id"),
        ])
        .build(),
      "WorkflowType = 'counter' AND (WorkflowId = 'my-workflow-id' AND RunId = 'my-run-id')",
    );

    assert.strictEqual(
      new QueryBuilder()
        .where("WorkflowType")
        .eq("counter")
        .or([
          new QueryBuilder().where("WorkflowId").eq("my-workflow-id"),
          new QueryBuilder().where("RunId").eq("my-run-id"),
        ])
        .build(),
      "WorkflowType = 'counter' AND (WorkflowId = 'my-workflow-id' OR RunId = 'my-run-id')",
    );

    assert.strictEqual(
      new QueryBuilder()
        .where("WorkflowType")
        .eq("counter")
        .or([
          new QueryBuilder().where("WorkflowId").eq("my-workflow-id"),
          new QueryBuilder().where("RunId").eq("my-run-id"),
        ])
        .where("TaskQueue")
        .eq("high-priority")
        .build(),

      "WorkflowType = 'counter' AND (WorkflowId = 'my-workflow-id' OR RunId = 'my-run-id') AND TaskQueue = 'high-priority'",
    );
  });
});
