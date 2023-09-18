import { createTemporalConfiguration } from "../src/configuration.js";
import z from "zod";

export const configuration = createTemporalConfiguration({
  namespace: "default",
  taskQueues: {
    "high-priority": true,
  },
  activities: {
    sayHello: {
      args: z.tuple([z.object({ name: z.string() })]),
      returnValue: z.string(),
    },
    scoped$doSomething: {
      args: z.tuple([]),
      returnValue: z.number(),
    },
  },
  workflows: {
    bigIncrement: {
      args: z.tuple([z.object({ initialValue: z.bigint().positive() })]),
      returnValue: z.bigint(),
    },
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
    heartbeat: {
      args: z.tuple([]),
      returnValue: z.string(),
    },
    increment: {
      args: z.tuple([z.object({ initialValue: z.number().positive() })]),
      returnValue: z.number(),
    },
    helloWorld: {
      args: z.tuple([z.object({ name: z.string() })]),
      returnValue: z.string(),
    },
    parent: {
      args: z.tuple([z.object({ value: z.number() })]),
      returnValue: z.number(),
    },
    child: {
      args: z.tuple([z.object({ value: z.number() })]),
      returnValue: z.number(),
    },
    scoped: {
      args: z.tuple([]),
      returnValue: z.number(),
    },
    safeIterable: {
      args: z.tuple([z.object({ list: z.array(z.number()) })]),
      returnValue: z.void(),
    },
  },
  searchAttributes: {
    CustomIntField: "Int",
  },
  sinks: {
    analytics: {
      addEvent: {
        args: z.tuple([z.record(z.string(), z.any())]),
      },
    },
  },
});

export type Configuration = typeof configuration;
