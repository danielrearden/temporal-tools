import { defaultSinks, Worker } from "@temporalio/worker";
import {
  AllActivities,
  NamespaceConfiguration,
  TypedActivity,
  TypedInjectedSink,
  TypedWorkerOptions,
} from "./types.js";

/**
 * Returns a set of type-safe utilities for creating a Temporal worker.
 */
export const createWorkerHelpers = <TConfig extends NamespaceConfiguration, TContext>(
  config: TConfig,
): {
  /**
   * Creates a set of activity functions to pass to `createWorker` from the provided activity
   * context object and activity factories.
   */
  createActivities: (
    context: TContext,
    factories: {
      [TActivity in keyof TConfig["activities"]]: (
        context: TContext,
      ) => TypedActivity<TConfig, TActivity>;
    },
  ) => AllActivities<TConfig>;
  /**
   * Creates an activity factory function for the provided activity name. The factory takes the
   * activity context object and returns the final activity function. The resulting factory function
   * should be passed to `createActivities`.
   */
  createActivityFactory: <TActivity extends keyof TConfig["activities"]>(
    activity: TActivity,
    factory: (context: TContext) => TypedActivity<TConfig, TActivity>,
  ) => (context: TContext) => TypedActivity<TConfig, TActivity>;
  /**
   * Creates a sink implementation for the provided sink name.
   */
  createSink: <TSink extends keyof TConfig["sinks"]>(
    name: TSink,
    implementation: TypedInjectedSink<TConfig, TSink>,
  ) => TypedInjectedSink<TConfig, TSink>;
  /**
   * Creates a Temporal worker with the provided options.
   */
  createWorker: (options: TypedWorkerOptions<TConfig>) => Promise<Worker>;
} => {
  return {
    createActivities: (context, factories) => {
      const activities = {} as AllActivities<TConfig>;
      for (const activityName in factories) {
        activities[activityName] = factories[activityName](context);
      }

      return activities;
    },
    createActivityFactory: (_activity, factory) => {
      return (context) => {
        return factory(context);
      };
    },
    createSink: (_name, implementation) => {
      return implementation;
    },
    createWorker: (options) => {
      return Worker.create({
        ...options,
        sinks: { ...defaultSinks(), ...options.sinks },
        namespace: config.namespace,
        taskQueue: options.taskQueue as string,
      });
    },
  };
};
