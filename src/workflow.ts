import {
  continueAsNew,
  defineQuery,
  defineSignal,
  executeChild,
  makeContinueAsNewFunc,
  proxyActivities,
  proxyLocalActivities,
  proxySinks,
  setHandler,
  startChild,
  upsertSearchAttributes,
  workflowInfo,
  ApplicationFailure,
  QueryDefinition,
  SignalDefinition,
} from "@temporalio/workflow";
import { ZodTuple, ZodTypeAny, z } from "zod";
import {
  NamespaceConfiguration,
  TypedProxiedActivities,
  TypedActivityOptions,
  TypedChildWorkflowHandle,
  TypedChildWorkflowOptions,
  TypedSearchAttributes,
  TypedSinks,
  WorkflowContext,
  WithTypedWorkflowArgs,
  WorkflowArgumentZodSchemas,
} from "./types.js";

/**
 * Returns a set of utility functions for creating type-safe Temporal workflows.
 */
export const createWorkflowHelpers = <TConfig extends NamespaceConfiguration>(): {
  /**
   * Creates a workflow function for the provided workflow type. The workflow function is passed
   * a workflow context object as its last argument, which includes a further set of workflow-specific utilities.
   */
  createWorkflow: <TWorkflowType extends keyof TConfig["workflows"]>(
    workflowType: TWorkflowType,
    workflow: (
      ...args: [
        ...Parameters<TConfig["workflows"][TWorkflowType]["fn"]>,
        WorkflowContext<TConfig, TWorkflowType>,
      ]
    ) => ReturnType<TConfig["workflows"][TWorkflowType]["fn"]>,
    schema?: WorkflowArgumentZodSchemas<TConfig, TWorkflowType>,
  ) => (
    ...args: Parameters<TConfig["workflows"][TWorkflowType]["fn"]>
  ) => ReturnType<TConfig["workflows"][TWorkflowType]["fn"]>;
  /**
   * Start a child Workflow execution and await its completion.
   */
  executeChild: <TWorkflowType extends keyof TConfig["workflows"]>(
    workflowType: TWorkflowType,
    options: WithTypedWorkflowArgs<TConfig, TWorkflowType, TypedChildWorkflowOptions<TConfig>>,
  ) => Promise<ReturnType<TConfig["workflows"][TWorkflowType]["fn"]>>;
  /**
   * Configure Activity functions with given {@link ActivityOptions}.
   *
   * This method may be called multiple times to setup Activities with different options.
   */
  proxyActivities: (options: TypedActivityOptions<TConfig>) => TypedProxiedActivities<TConfig>;
  /**
   * Configure Local Activity functions with given {@link LocalActivityOptions}.
   *
   * This method may be called multiple times to setup Activities with different options.
   */
  proxyLocalActivities: (options: TypedActivityOptions<TConfig>) => TypedProxiedActivities<TConfig>;
  /**
   * Get a reference to Sinks for exporting data out of the Workflow.
   */
  proxySinks: () => TypedSinks<TConfig>;
  /**
   * Start a child Workflow execution
   *
   * - Returns a client-side handle that implements a child Workflow interface.
   * - By default, a child will be scheduled on the same task queue as its parent.
   *
   * A child Workflow handle supports awaiting completion, signaling and cancellation via {@link CancellationScope}s.
   * In order to query the child, use a {@link WorkflowClient} from an Activity.
   */
  startChild: <TWorkflowType extends keyof TConfig["workflows"]>(
    workflowType: TWorkflowType,
    options: WithTypedWorkflowArgs<TConfig, TWorkflowType, TypedChildWorkflowOptions<TConfig>>,
  ) => TypedChildWorkflowHandle<TConfig, TWorkflowType>;
  /**
   * Updates this Workflow's Search Attributes by merging the provided `searchAttributes` with the existing Search
   * Attributes, `workflowInfo().searchAttributes`.
   */
  upsertSearchAttributes: (searchAttributes: TypedSearchAttributes<TConfig>) => void;
} => {
  return {
    createWorkflow: (workflowType, workflow: any, schema) => {
      const signals: Record<string, SignalDefinition> = {};
      const queries: Record<string, QueryDefinition<any>> = {};
      const getSignal = (signalName: string) => {
        if (typeof signals[signalName] === "undefined") {
          signals[signalName] = defineSignal(signalName);
        }

        return signals[signalName];
      };
      const getQuery = (queryName: string) => {
        if (typeof queries[queryName] === "undefined") {
          queries[queryName] = defineQuery(queryName);
        }

        return queries[queryName];
      };

      const context = {
        continueAsNew: continueAsNew as any,
        createSafeAsyncIterable: (
          iterable,
          createContinueAsNewArgs,
          { maxHistoryEvents = 10_240, maxHistorySize = 1_000_000 } = {},
        ) => {
          return {
            [Symbol.asyncIterator]: () => {
              const iterator =
                Symbol.iterator in iterable
                  ? iterable[Symbol.iterator]()
                  : iterable[Symbol.asyncIterator]();

              let index = -1;
              let lastValue: any = undefined;

              return {
                next: async () => {
                  if (index !== -1) {
                    const info = workflowInfo();

                    if (
                      info.historySize >= maxHistorySize ||
                      info.historyLength >= maxHistoryEvents
                    ) {
                      await continueAsNew(...createContinueAsNewArgs(lastValue, index));
                    }
                  }

                  const { value, done } = await iterator.next();
                  if (done) {
                    return { value, done };
                  }

                  lastValue = value;
                  index++;

                  return { value, done };
                },
                return: iterator.return,
                throw: iterator.throw,
              };
            },
          };
        },
        makeContinueAsNewFn: ({ ...options }) => {
          return makeContinueAsNewFunc({
            workflowType: workflowType as string,
            ...(options as any),
          }) as any;
        },
        proxyScopedActivities: (options) => {
          return new Proxy(proxyActivities(options), {
            get: (target, prop) => {
              if (
                typeof prop === "string" &&
                typeof target[`${workflowType as string}$${prop}`] !== "undefined"
              ) {
                return target[`${workflowType as string}$${prop}`];
              }

              return undefined;
            },
          }) as any;
        },
        setSignalHandler: (signalName, handler) => {
          setHandler(getSignal(signalName as string), handler);
        },
        setQueryHandler: (queryName, handler) => {
          setHandler(getQuery(queryName as string), handler);
        },
      } as WorkflowContext<TConfig, keyof TConfig["workflows"]>;

      return (...args: any[]) => {
        if (schema) {
          return z
            .tuple(schema as any)
            .safeParseAsync(args)
            .then((result) => {
              if (result.success) {
                return workflow(...(result.data as any), context);
              } else {
                const errors = result.error.issues
                  .map((issue) => {
                    const path =
                      "args" +
                      issue.path
                        .map((part) => {
                          if (typeof part === "number") {
                            return `[${part}]`;
                          } else {
                            return `.${part}`;
                          }
                        })
                        .join("");
                    return `  ${path}: ${issue.message}`;
                  })
                  .join("\n");
                const message = `Invalid workflow arguments:\n${errors}`;
                throw new ApplicationFailure(message, null, true);
              }
            }) as ReturnType<TConfig["workflows"][typeof workflowType]["fn"]>;
        } else {
          return workflow(...args, context) as ReturnType<
            TConfig["workflows"][typeof workflowType]["fn"]
          >;
        }
      };
    },
    executeChild: executeChild as any,
    proxyActivities: proxyActivities as any,
    proxyLocalActivities: proxyLocalActivities as any,
    proxySinks: proxySinks as any,
    startChild: startChild as any,
    upsertSearchAttributes: upsertSearchAttributes as any,
  };
};
