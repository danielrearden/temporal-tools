<center>
<h1><code>temporal-tools</code> 🧰</h1>
</center>

`temporal-tools` is a set of utilities for building Temporal applications, with a focus on DX and type-safety.

- Type-safe code without needing to import types everywhere 🚀
- Developer-friendly APIs for creating Workflows, Activities, Sinks, and more. 💖
- Built-in dependency injection for Activities 💉
- Validation for Workflow arguments ✅
- Custom data converter for easy serialization of custom types 🔄
- Scoped Activities that are specific to individual Workflows ⌖
- Query builder for creating List Filters 🏗️

## Usage

### Examples

See the [example](https://github.com/danielrearden/temporal-tools/tree/main/example) directory for example usage. Please also refer to the official TypeScript SDK documentation [here](https://docs.temporal.io/dev-guide/typescript/introduction) and the TypeScript SDK reference [here](https://typescript.temporal.io/) if you're unfamiliar with the SDK or Temporal in general.

### Configuration

Define the configuration for your Temporal namespace by calling `createTemporalConfiguration`. This configuration object will be shared by all parts of your application (Worker, Workflow and Client), so depending on your repository setup, you may want to publish it as a package that can be imported everywhere.

```typescript
export const configuration = createTemporalConfiguration({
  namespace: "my-app",
  taskQueues: ["high-priority", "low-priority"],
  activities: {
    sayHello: {
      args: z.tuple([z.object({ name: z.string() })]),
      returnValue: z.string(),
    },
  },
  workflows: {
    helloWorld: {
      args: z.tuple([z.object({ name: z.string() })]),
      returnValue: z.string(),
    },
  },
  sinks: {
    analytics: {
      addEvent: {
        args: z.tuple([z.record(z.string(), z.any())]),
      },
    },
  },
});
```

### Workflows

Inside your bundled Workflow code, generate a set of helpers by calling `createWorkflowHelpers`:

```typescript
export const {
  createWorkflow,
  executeChild,
  proxyActivities,
  proxyLocalActivities,
  proxySinks,
  startChild,
  upsertSearchAttributes,
} = createWorkflowHelpers(configuration);
```

Functions like `proxyActivities` and `startChild` work exactly like the functions exported by `@temporalio/workflow` but are typed based on your configuration.

#### Creating Workflows

Workflows are created by calling the `createWorkflow` function returned by `createWorkflowHelpers`. The function takes the Workflow type and a handler function as arguments. The handler is called with the arguments provided to the Workflow and a context object.

```typescript
const { sayHello } = proxyActivities();

export const helloWorld = createWorkflow("helloWorld", async ({ name }, context) => {
  await sayHello({ name });
});
```

The context object includes several utilities that are typed based on the Workflow type being added:

- `continueAsNew` - typed variant of the function exported by `@temporal/workflow`
- `makeContinueAsNewFn` - typed variant of the function exported by `@temporal/workflow`
- `setSignalHandler` - see [Signals and Queries](#signals-and-queries)
- `setQueryHandler` - see [Signals and Queries](#signals-and-queries)
- `proxyScopedActivities` - see [Scoped Activities](#scoped-activities)
- `createSafeAsyncIterable` - see [createSafeAsyncIterable](#createsafeasynciterable)

#### Signals and Queries

Signals and Queries are defined in your configuration for each Workflow.

```typescript
export const configuration = createTemporalConfiguration({
  workflows: {
    counter: {
      args: z.tuple([z.object({ initialValue: z.number().positive() })]),
      returnValue: z.void(),
      signals: {
        increment: {
          args: z.tuple([z.object({ delta: z.number().positive() })]),
        },
      },
      queries: {
        get: {
          args: z.tuple([]),
          returnValue: z.number(),
        },
      },
    },
  },
  ...
});
```

Then, inside your Workflow, use the `setSignalHandler` and `setQueryHandler` functions exposed on the Workflow context. These functions replace the `setHandler` function exported by `@temporalio/workflow`.

```typescript
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
```

> ⚠️ Note that you do **not** need to call `defineSignal` or `defineQuery` in your code -- this is done automatically based on your configuration.

#### Workflow argument validation

The `zod` schemas you provide when defining your Workflow's arguments are used to validate the arguments provided to the Workflow function. If the arguments are not valid, your Workflow will fail before any of its handler code is executed. This application failure is a [non-retryable error](https://docs.temporal.io/retry-policies#non-retryable-errors).

#### `createSafeAsyncIterable`

Temporal stores all the events associated with a Workflow execution in its Event History. Temporal limits the size of the Event History for each Workflow, and will fail the Workflow if this limit is reached. To avoid hitting this limit, we can use `continueAsNew` to start a new Workflow execution with a fresh Event History. `createSafeAsyncIterable` takes an existing `Iterable` or `AsyncIterable` (like an `Array`), and returns a new `AsyncIterable` that can be iterated like normal. However, the returned `AsyncIterable` will call `continueAsNew` for you once the Event History grows large enough. This lets you loop over large collections without needing to implement batching logic yourself.

```typescript
export const safeIterable = createWorkflow(
  "safeIterable",
  async ({ list }, { createSafeAsyncIterable }) => {
    const safeList = createSafeAsyncIterable(
      list,
      (lastValue, lastIndex) => {
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
```

In the example above, we iterate over each item in the provided `list` until an arbitrary Event History limit of 30 events is reached. Once that happens, `continueAsNew` is called with the remaining items in the list and the Workflow continues where it left off.

### Workers

Inside your worker code, generate a set of helpers by calling `createWorkerHelpers`:

```typescript
export const { createActivities, createActivityFactory, createWorker } = createWorkerHelpers<
  Configuration,
  ActivityContext
>(configuration);
```

> ⚠️ Note: In order to get the correct typing, you'll need explicitly pass in the type of your configuration object and a type for your Activity Context (see [Activities](#Activities) below).

Create your worker instance by calling `createWorker`. The options passed to `createWorker` are identical to those passed to `Worker.create` but are typed based on your configuration. You also don't need to specify the `namespace` since this is already defined in your configuration.

```typescript
const worker = await createWorker({
  workflowsPath: require.resolve("./workflows"),
  taskQueue: "high-priority",
  activities,
});
```

### Activities

The `createActivities` and `createActivityFactory` functions returned by `createWorkerHelpers` are designed to make dependency simpler when creating Activities. Instead of writing an Activity function, you'll write a factory function that takes a context object and returns the Activity function:

```typescript
export const sayHello = createActivityFactory("sayHello", (context) => {
  return async ({ name }) => {
    const nameExists = await checkIfNameExists(name, context.databasePool);

    if (nameExists) {
      return `Nice to meet you, ${name}!`;
    }

    return `Hello again, ${name}!`;
  };
});
```

The context object can be anything you want to inject into your Activities. You'll need to provide a type for the context when calling `createWorkerHelpers`. The Activity factories you create are passed to `createActivityFactory`, which takes the context as an argument.

```typescript
export const activities = createActivities(context, {
  sayHello,
});
```

The resulting `activities` object can then be passed to `createWorker`.

#### Scoped Activities

Normally, an Activity can be called by any Workflow. Scoped Activities allow you to define Activities that can only be called from a specific Workflow. A Scoped Activity is defined by prefixing its name with the Workflow type and `$`:

```typescript
export const configuration = createTemporalConfiguration({
  activities: {
    greeting$sayHello: {
      args: z.tuple([z.object({ name: z.string() })]),
      returnValue: z.string(),
    },
  },
  ...
});
```

The Scoped Activity can then be accessed using the `proxyScopedActivities` function exposed on the Workflow's context:

```typescript
export const greeting = createActivityFactory("greeting", (context) => {
  return async ({ name }, { proxyScopedActivities }) => {
    const { sayHello } = proxyScopedActivities({
      scheduleToCloseTimeout: "5m",
    });

    return sayHello({ name });
  };
});
```

### Creating Sinks

Define the available [Sinks](https://docs.temporal.io/dev-guide/typescript/observability#logging-from-workflows-with-workflow-sinks) inside your configuration:

```typescript

const configuration = createTemporalConfiguration({
  sinks: {
    log: {
      error: {
        args: z.tuple([z.string()]),
      },
    },
  },
  ...
})
```

You can then create correctly typed sinks using the `createSink` utility returned by `createWorkerHelpers`:

```typescript
export const analytics = createSink("log", {
  error: {
    fn: (info, message) => {
      console.error(`[${info.workflowType}]: ${message}`);
    },
  },
});
```

### Client

Create a typed Temporal Client instance by calling `createClient`.

```typescript
const client = createClient(configuration, options);
```

The options passed to `createClient` are identical to those passed to the `Client` constructor, although the `namespace` is omitted since its already defined as part of your configuration.

### Data Conversion

Temporal's SDK allows you to implement serialization and deserialization logic for data types not supported by the [default Data Converter](https://docs.temporal.io/dataconversion#default-data-converter) by implenting your own. The `CustomPayloadConverter` is a custom converter implementation that easily lets you add support for any data types you need.

Start by instantiating the converter and exporting it as `payloadConverter`.

```typescript
export const payloadConverter = new CustomPayloadConverter({
  serializers: {
    bigint: BigIntSerializer,
  },
});
```

The `CustomPayloadConverter` constructor accepts a map of serializers. Each serializer is used to serialize and deserialize a particular type. `temporal-tools` provides a few, common serializers out-of-the-box:

- `BigIntSerializer`
- `DateSerializer`
- `URLSerializer`
- `RegExpSerializer`

You can easily roll your own serializer for any type by calling `createCustomDataConverterSerializer`:

```typescript
class Point {
  public constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

const PointSerializer = createCustomDataConverterSerializer<Point, [number, number]>({
  isTypeOf: (value) => value instanceof Point,
  serialize: ({ x, y }) => [x, y],
  deserialize: (serialized) => {
    const [x, y] = serialized;
    return new Point(x, y);
  },
});
```

When defining arguments and return values in your configuration object, `temporal-tools` intentionally limits the allowed `zod` types used to those that are serializable and will show a type error if you attempt to use something like `z.date()`. In order to indicate that date is a serializable type, create a type declaration with the types implemented by your custom converter:

```typescript
declare module "temporal-tools" {
  interface CustomDataConverterTypeMap {
    bigint: bigint;
    date: Date;
    point: Point;
  }
}
```

Note that this will also constrain the `serializers` you can pass when instantiating your `CustomPayloadConverter`!

For custom types like the `Point` class, you'll also need a custom `zod` schema to use in your configuration. Every serializer exposes this as a property for convenience:

```typescript
const pointSchema = PointSerializer.zodType;

const schema = z.object({
  location: pointSchema.nullable(),
});
```

Lastly, as shown in the [docs](https://docs.temporal.io/dev-guide/typescript/features#custom-payload-conversion), the filepath to the payload converter should be passed to both the Client and the Worker as part of their options:

```typescript
const client = createClient(configuration, {
  dataConverter: {
    payloadConverterPath: createRequire(import.meta.url).resolve("./payloadConverter.ts"),
  },
});
```

### List Filter Query Builder

When calling `client.workflow.list`, you can provide an optional `query` string to filter your results. While the syntax for these queries is relatively [straightforward](https://docs.temporal.io/visibility#supported-operators), writing them by hand is still error-prone. We can instead use a query builder to generate the necessary `query` string:

```
const ListFilterQueryBuilder = createListFilterQueryBuilder(configuration);

const query = new ListFilterQueryBuilder()
  .where("WorkflowType")
  .eq("counter")
  .where("CustomField")
  .eq("a custom value")
  .build()
```

The `ListFilterQueryBuilder` class returned by `createListFilterQueryBuilder` will accept any of the [default search attributes](https://docs.temporal.io/visibility#default-search-attributes) as well as any custom ones you defined as part of your configuration.
