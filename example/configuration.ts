import { CreateConfiguration, SafeFunction } from "../src/types.js";

export type Configuration = CreateConfiguration<{
  namespace: "default";
  taskQueues: ["high-priority"];
  activities: {
    generic: SafeFunction<<T extends string | number>(args: { value: T }) => Promise<T>>;
    sayHello: SafeFunction<(args: { name: string }) => Promise<string>>;
    scoped$doSomething: SafeFunction<() => Promise<number>>;
  };
  workflows: {
    bigIncrement: {
      fn: SafeFunction<(args: { initialValue: bigint }) => Promise<bigint>>;
    };
    counter: {
      fn: SafeFunction<(args: { initialValue: number }) => Promise<void>>;
      signals: {
        increment: SafeFunction<(args: { delta: number }) => Promise<void>>;
      };
      queries: {
        get: SafeFunction<() => number>;
      };
    };
    heartbeat: {
      fn: SafeFunction<() => Promise<string>>;
    };
    increment: {
      fn: SafeFunction<(args: { initialValue: number }) => Promise<number>>;
    };
    helloWorld: {
      fn: SafeFunction<(args: { name: string }) => Promise<string>>;
    };
    parent: {
      fn: SafeFunction<(args: { value: number }) => Promise<number>>;
    };
    child: {
      fn: SafeFunction<(args: { value: number }) => Promise<number>>;
    };
    scoped: {
      fn: SafeFunction<() => Promise<number>>;
    };
    safeIterable: {
      fn: SafeFunction<(args: { list: number[] }) => Promise<void>>;
    };
    withGenericActivity: {
      fn: SafeFunction<(args: { value: string | number }) => Promise<void>>;
    };
  };
  searchAttributes: {
    CustomIntField: "Int";
  };
  sinks: {
    analytics: {
      addEvent: SafeFunction<(args: Record<string, any>) => Promise<void>>;
    };
  };
}>;
