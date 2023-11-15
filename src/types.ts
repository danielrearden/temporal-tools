import {
  Client,
  ScheduleClient,
  ScheduleHandle,
  ScheduleOptions,
  WorkflowClient,
  WorkflowHandle,
  WorkflowOptions,
} from "@temporalio/client";
import { ActivityOptions, Duration, VersioningIntent } from "@temporalio/common";
import { WorkerOptions } from "@temporalio/worker";
import {
  ChildWorkflowOptions,
  ChildWorkflowHandle,
  ExternalWorkflowHandle,
  WorkflowInfo,
} from "@temporalio/workflow";
import { ZodType } from "zod";

export interface CustomDataConverterTypeMap {}

export type CustomDataConverterSerializers = {
  [K in keyof CustomDataConverterTypeMap]: CustomDataConverterSerializer<
    CustomDataConverterTypeMap[K]
  >;
};

export type CustomDataConverterSerializer<TType> = {
  isTypeOf: (value: unknown) => boolean;
  deserialize: (content: any) => TType;
  serialize: (value: TType) => any;
};

export type Json =
  | Json[]
  | boolean
  | number
  | string
  | {
      [key: string]: Json;
    }
  | null;

export type SupportedType =
  | SupportedType[]
  | boolean
  | number
  | string
  | {
      [key: string]: SupportedType;
    }
  | null
  | undefined
  | void
  | CustomDataConverterTypeMap[keyof CustomDataConverterTypeMap];

export type SafeFunction<T extends (...args: any[]) => any> = Parameters<T> extends SupportedType[]
  ? ReturnType<T> extends SupportedType | Promise<SupportedType>
    ? T
    : unknown
  : unknown;

export type NamespaceConfiguration = {
  /**
   * Configuration for all activities in the namespace
   */
  activities: Record<string, (...args: any[]) => Promise<any>>;
  /**
   * The namespace to use for all workflows and activities
   */
  namespace: string;
  /**
   * Configuration for all search attributes. Note that search attributes are actually cluster-wide,
   * but we define them per namespace.
   */
  searchAttributes: Record<string, SearchAttributeType>;
  /**
   * Configuration for all sinks
   */
  sinks: Record<string, SinkConfiguration>;
  /**
   * Configuration for all task queues in the namespace
   */
  taskQueues: [string, ...string[]];
  /**
   * Configuration for all workflows in the namespace
   */
  workflows: Record<string, WorkflowConfiguration>;
};

export type CreateConfiguration<T extends NamespaceConfiguration> = T;

/**
 * Types of search attributes supported by Temporal.
 * See https://docs.temporal.io/visibility#supported-types
 */
export type SearchAttributeType = "Bool" | "Datetime" | "Double" | "Int" | "Keyword" | "Text";

export type SearchAttributeTypeToTSType<TSearchAttributeType extends SearchAttributeType> =
  TSearchAttributeType extends "Bool"
    ? boolean
    : TSearchAttributeType extends "Datetime"
    ? Date
    : TSearchAttributeType extends "Double"
    ? number
    : TSearchAttributeType extends "Int"
    ? number
    : TSearchAttributeType extends "Keyword"
    ? string
    : TSearchAttributeType extends "Text"
    ? string
    : never;

/**
 * Configuration for an individual sink. Each sink defines a set of methods that can be called from workflows.
 * See https://docs.temporal.io/dev-guide/typescript/observability#logging-from-workflows-with-workflow-sinks
 */
export type SinkConfiguration = Record<string, SinkFunction>;

export type SinkFunction = (...args: any[]) => void | Promise<void>;

export type WorkflowConfiguration = {
  /**
   * The workflow function
   */
  fn: (...args: any[]) => Promise<any>;
  /**
   * Configuration for all signals that the workflow can receive
   */
  signals?: Record<string, SignalFunction>;
  /**
   * Configuration for all queries that the workflow can receive
   */
  queries?: Record<string, QueryFunction>;
};

export type SignalFunction = (...args: any[]) => Promise<void>;

export type QueryFunction = (...args: any[]) => any;

export type TypedProxiedActivities<TConfig extends NamespaceConfiguration> = {
  [TActivity in keyof TConfig["activities"] as TActivity extends ScopedActivityName<
    Extract<keyof TConfig["workflows"], string>,
    string
  >
    ? never
    : TActivity]: TypedActivity<TConfig, TActivity>;
};

export type AllActivities<TConfig extends NamespaceConfiguration> = {
  [TActivity in keyof TConfig["activities"]]: TypedActivity<TConfig, TActivity>;
};

export type ScopedActivities<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = {
  [TActivity in keyof TConfig["activities"] as TActivity extends ScopedActivityName<
    Extract<TWorkflowType, string>,
    infer Name
  >
    ? Name
    : never]: TypedActivity<TConfig, TActivity>;
};

export type ScopedActivityName<
  TWorkflowType extends string,
  TActivity extends string,
> = `${TWorkflowType}$${TActivity}`;

export type TypedActivity<
  TConfig extends NamespaceConfiguration,
  TActivity extends keyof TConfig["activities"],
> = TConfig["activities"][TActivity];

/**
 * Options for remote activity invocation
 */
export type TypedActivityOptions<TConfig extends NamespaceConfiguration> = Omit<
  ActivityOptions,
  "taskQueue" | "startToCloseTimeout" | "scheduleToCloseTimeout"
> & {
  /**
   * Task queue name.
   *
   * @default current worker task queue
   */
  taskQueue?: TConfig["taskQueues"][number] | (string & {});
} & (
    | {
        /**
         * Maximum time of a single Activity execution attempt. Note that the Temporal Server doesn't detect Worker process
         * failures directly. It relies on this timeout to detect that an Activity that didn't complete on time. So this
         * timeout should be as short as the longest possible execution of the Activity body. Potentially long running
         * Activities must specify {@link heartbeatTimeout} and call {@link activity.Context.heartbeat} periodically for
         * timely failure detection.
         *
         * Either this option or {@link scheduleToCloseTimeout} is required.
         *
         * @default `scheduleToCloseTimeout` or unlimited
         * @format number of milliseconds or {@link https://www.npmjs.com/package/ms | ms-formatted string}
         */
        startToCloseTimeout: Duration;
        /**
         * Total time that a workflow is willing to wait for Activity to complete.
         * `scheduleToCloseTimeout` limits the total time of an Activity's execution including retries (use {@link startToCloseTimeout} to limit the time of a single attempt).
         *
         * Either this option or {@link startToCloseTimeout} is required.
         *
         * @default unlimited
         * @format number of milliseconds or {@link https://www.npmjs.com/package/ms | ms-formatted string}
         */
        scheduleToCloseTimeout?: Duration;
      }
    | {
        /**
         * Maximum time of a single Activity execution attempt. Note that the Temporal Server doesn't detect Worker process
         * failures directly. It relies on this timeout to detect that an Activity that didn't complete on time. So this
         * timeout should be as short as the longest possible execution of the Activity body. Potentially long running
         * Activities must specify {@link heartbeatTimeout} and call {@link activity.Context.heartbeat} periodically for
         * timely failure detection.
         *
         * Either this option or {@link scheduleToCloseTimeout} is required.
         *
         * @default `scheduleToCloseTimeout` or unlimited
         * @format number of milliseconds or {@link https://www.npmjs.com/package/ms | ms-formatted string}
         */
        startToCloseTimeout?: Duration;
        /**
         * Total time that a workflow is willing to wait for Activity to complete.
         * `scheduleToCloseTimeout` limits the total time of an Activity's execution including retries (use {@link startToCloseTimeout} to limit the time of a single attempt).
         *
         * Either this option or {@link startToCloseTimeout} is required.
         *
         * @default unlimited
         * @format number of milliseconds or {@link https://www.npmjs.com/package/ms | ms-formatted string}
         */
        scheduleToCloseTimeout: Duration;
      }
  );

/**
 * Options to configure the Worker
 *
 * Some options can significantly affect Worker's performance. Default settings are generally appropriate for
 * day-to-day development, but unlikely to be suitable for production use. We recommend that you explicitly set
 * values for every performance-related option on production deployment.
 */
export type TypedWorkerOptions<TConfig extends NamespaceConfiguration> = Omit<
  WorkerOptions,
  "activities" | "namespace" | "sinks" | "taskQueue"
> & {
  /**
   * Mapping of activity name to implementation
   */
  activities: AllActivities<TConfig>;
  namespace: TConfig["namespace"];
  /**
   * The task queue the worker will pull from
   */
  taskQueue: TConfig["taskQueues"][number] | (string & {});
  /**
   * Registration of a SinkFunction, including per-sink-function options.
   *
   * Sinks are a mechanism for exporting data out of the Workflow sandbox. They are typically used
   * to implement in-workflow observability mechanisms, such as logs, metrics and traces.
   *
   * To prevent non-determinism issues, sink functions may not have any observable side effect on the
   * execution of a workflow. In particular, sink functions may not return values to the workflow,
   * nor throw errors to the workflow (an exception thrown from a sink function simply get logged to
   * the Runtime's logger).
   *
   * For similar reasons, sink functions are not executed immediately when a call is made from
   * workflow code. Instead, calls are buffered until the end of the workflow activation; they get
   * executed right before returning a completion response to Core SDK. Note that the time it takes to
   * execute sink functions delays sending a completion response to the server, and may therefore
   * induce Workflow Task Timeout errors. Sink functions should thus be kept as fast as possible.
   *
   * Sink functions are always invoked in the order that calls were maded in workflow code. Note
   * however that async sink functions are not awaited individually. Consequently, sink functions that
   * internally perform async operations may end up executing concurrently.
   *
   * Please note that sink functions only provide best-effort delivery semantics, which is generally
   * suitable for log messages and general metrics collection. However, in various situations, a sink
   * function call may execute more than once even though the sink function is configured with
   * `callInReplay: false`. Similarly, sink function execution errors only results in log messages,
   * and are therefore likely to go unnoticed. For use cases that require _at-least-once_ execution
   * guarantees, please consider using local activities instead. For use cases that require
   * _exactly-once_ or _at-most-once_ execution guarantees, please consider using regular activities.
   *
   * The SDK itself may register sinks functions required to support workflow features. At the moment, the only such
   * sink is 'defaultWorkerLogger', which is used by the workflow context logger (ie. `workflow.log.info()` and
   * friends); other sinks may be added in the future. You may override these default sinks by explicitely registering
   * sinks with the same name.
   */
  sinks: {
    [TSink in keyof TConfig["sinks"]]: {
      [TSinkFunction in keyof TConfig["sinks"][TSink]]: {
        fn(
          info: WorkflowInfo,
          ...args: Parameters<TConfig["sinks"][TSink][TSinkFunction]>
        ): void | Promise<void>;
        callDuringReplay?: boolean;
      };
    };
  };
};

export type TypedInjectedSink<
  TConfig extends NamespaceConfiguration,
  TSink extends keyof TConfig["sinks"],
> = {
  [TSinkFunction in keyof TConfig["sinks"][TSink]]: {
    /**
     * The implementation function for sink function `F`
     */
    fn(
      info: WorkflowInfo,
      ...args: Parameters<TConfig["sinks"][TSink][TSinkFunction]>
    ): void | Promise<void>;
    /**
     * Whether or not the function will be called during Workflow replay.
     *
     * Take note that setting `callDuringReplay` to `false` (or leaving it unset) doesn't guarantee
     * that the sink function will only ever run once for a particular Workflow execution at a
     * particular point of its history. In particular, calls to sink functions will be executed
     * even if the current workflow task ends up failling or timing out. In such situations, a call to
     * a sink function configured with `callDuringReplay: false` will be executed again, since
     * the workflow task is not being replayed (ie. retrying a workflow task is not the same as
     * replaying it).
     *
     * For use cases that require _at-most-once_ or _exactly-once_ guarantees, please consider using
     * a regular activity instead.
     *
     * Defaults to `false`.
     */
    callDuringReplay?: boolean;
  };
};

export type TypedSinks<TConfig extends NamespaceConfiguration> = {
  [TSink in keyof TConfig["sinks"]]: {
    [TSinkFunction in keyof TConfig["sinks"][TSink]]: (
      ...args: Parameters<TConfig["sinks"][TSink][TSinkFunction]>
    ) => Promise<void>;
  };
};

export type WorkflowContext<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = {
  /**
   * {@link https://docs.temporal.io/concepts/what-is-continue-as-new/ | Continues-As-New} the current Workflow Execution
   * with default options.
   *
   * Shorthand for `makeContinueAsNewFunc<F>()(...args)`. (See: {@link WorkflowContext.makeContinueAsNewFn}.)
   *
   */
  continueAsNew: (...args: Parameters<TConfig["workflows"][TWorkflowType]["fn"]>) => Promise<never>;
  /**
   * Takes an Iterable or AsyncIterable and returns an AsyncIterable that will
   * ContinueAsNew the current Workflow Execution when the event history grows too large.
   *
   * The `createContinueAsNewArgs` function is called with the last value and index of the iterable
   * when the Workflow Execution is about to ContinueAsNew.
   *
   * The `maxHistoryEvents` and `maxHistorySize` options can be optionally provided to control when
   * the Workflow Execution will ContinueAsNew. If neither are provided, the Workflow Execution will
   * ContinueAsNew when the event history reaches 10,240 events or 1MB.
   */
  createSafeAsyncIterable: <T>(
    iterable: Iterable<T> | AsyncIterable<T>,
    createContinueAsNewArgs: (
      lastValue: T,
      lastIndex: number,
    ) => Parameters<TConfig["workflows"][TWorkflowType]["fn"]>,
    options?: {
      maxHistoryEvents?: number;
      maxHistorySize?: number;
    },
  ) => AsyncIterable<T>;
  /**
   * Returns a function `f` that will cause the current Workflow to ContinueAsNew when called.
   *
   * `f` takes the same arguments as the Workflow function supplied to typeparam `F`.
   *
   * Once `f` is called, Workflow Execution immediately completes.
   */
  makeContinueAsNewFn: (options: {
    taskQueue?: TConfig["taskQueues"][number] | (string & {});
    workflowRunTimeout?: Duration;
    workflowTaskTimeout?: Duration;
    memo?: Record<string, unknown>;
    searchAttributes?: TypedSearchAttributes<TConfig>;
    versioningIntent?: VersioningIntent;
  }) => (...args: Parameters<TConfig["workflows"][TWorkflowType]["fn"]>) => Promise<never>;
  /**
   * This function behaves like `proxyActivities`, but is limited to activities that are scoped to just this workflow.
   */
  proxyScopedActivities: (
    options: TypedActivityOptions<TConfig>,
  ) => ScopedActivities<TConfig, TWorkflowType>;
  /**
   * Set a handler function for one of this Workflow's signals.
   *
   * If this function is called multiple times for a given signal or query name the last handler will overwrite any previous calls.
   */
  setSignalHandler: TConfig["workflows"][TWorkflowType]["signals"] extends Record<
    string,
    SignalFunction
  >
    ? <TSignal extends keyof TConfig["workflows"][TWorkflowType]["signals"]>(
        signal: TSignal,
        handler: (
          ...args: Parameters<TConfig["workflows"][TWorkflowType]["signals"][TSignal]>
        ) => void | Promise<void>,
      ) => void
    : never;
  /**
   * Set a handler function for one of this Workflow's queries.
   *
   * If this function is called multiple times for a given signal or query name the last handler will overwrite any previous calls.
   */
  setQueryHandler: TConfig["workflows"][TWorkflowType]["queries"] extends Record<
    string,
    QueryFunction
  >
    ? <TQuery extends keyof TConfig["workflows"][TWorkflowType]["queries"]>(
        query: TQuery,
        handler: TConfig["workflows"][TWorkflowType]["queries"][TQuery],
      ) => void
    : never;
};

export type TypedSearchAttributes<TConfig extends NamespaceConfiguration> = {
  [TSearchAttribute in keyof TConfig["searchAttributes"]]?: Array<
    SearchAttributeTypeToTSType<TConfig["searchAttributes"][TSearchAttribute]>
  >;
};

export type TypedClient<TConfig extends NamespaceConfiguration> = Omit<
  Client,
  "schedule" | "workflow"
> & {
  /**
   * Schedule sub-client - use to start and interact with Schedules
   */
  schedule: TypedScheduleClient<TConfig>;
  /**
   * Workflow sub-client - use to start and interact with Workflows
   */
  workflow: TypedWorkflowClient<TConfig>;
};

export type TypedScheduleClient<TConfig extends NamespaceConfiguration> = Omit<
  ScheduleClient,
  "create"
> & {
  /**
   * Create a new Schedule.
   *
   * @throws {@link ScheduleAlreadyRunning} if there's a running (not deleted) Schedule with the given `id`
   * @returns a ScheduleHandle to the created Schedule
   */
  create: <TWorkflowType extends keyof TConfig["workflows"]>(
    options: TypedScheduleOptions<TConfig, TWorkflowType>,
  ) => Promise<ScheduleHandle>;
};

export type TypedScheduleOptions<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = Omit<ScheduleOptions<any>, "action"> & {
  /**
   * Which Action to take (i.e. which Workflow to start)
   */
  action: TypedScheduleOptionsAction<TConfig, TWorkflowType>;
};

export type TypedScheduleOptionsAction<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = {
  type: "startWorkflow";
  /**
   * Workflow id to use when starting. Assign a meaningful business id.
   * This ID can be used to ensure starting Workflows is idempotent.
   *
   * @default `${scheduleId}-workflow`
   */
  workflowId?: string;
  workflowType: TWorkflowType extends string ? TWorkflowType : never;
} & Pick<
  WithTypedWorkflowArgs<TConfig, TWorkflowType, TypedWorkflowOptions<TConfig>>,
  | "taskQueue"
  | "args"
  | "memo"
  | "searchAttributes"
  | "retry"
  | "workflowExecutionTimeout"
  | "workflowRunTimeout"
  | "workflowTaskTimeout"
>;

export type TypedWorkflowClient<TConfig extends NamespaceConfiguration> = Omit<
  WorkflowClient,
  "execute" | "getHandle" | "result" | "signalWithStart" | "start"
> & {
  /**
   * Starts a new Workflow execution and awaits its completion.
   *
   * @returns the result of the Workflow execution
   */
  execute: <TWorkflowType extends keyof TConfig["workflows"]>(
    workflowType: TWorkflowType,
    options: WithTypedWorkflowArgs<TConfig, TWorkflowType, TypedWorkflowOptions<TConfig>>,
  ) => ReturnType<TConfig["workflows"][TWorkflowType]["fn"]>;
  /**
   * Sends a Signal to a running Workflow or starts a new one if not already running and immediately Signals it.
   * Useful when you're unsure whether the Workflow has been started.
   *
   * @returns a {@link WorkflowHandle} to the started Workflow
   */
  signalWithStart: <
    TWorkflowType extends keyof TConfig["workflows"],
    TSignal extends TConfig["workflows"][TWorkflowType]["signals"] extends Record<
      string,
      SignalFunction
    >
      ? keyof TConfig["workflows"][TWorkflowType]["signals"]
      : never,
  >(
    workflowType: TWorkflowType,
    options: WithTypedWorkflowArgs<
      TConfig,
      TWorkflowType,
      TypedWorkflowSignalWithStartOptions<TConfig, TWorkflowType, TSignal>
    >,
  ) => Promise<TypedWorkflowHandleWithFirstExecutionRunId<TConfig, TWorkflowType>>;
  /**
   * Start a new Workflow execution.
   *
   * @returns a WorkflowHandle to the started Workflow
   */
  start: <TWorkflowType extends keyof TConfig["workflows"]>(
    workflowType: TWorkflowType,
    options: WithTypedWorkflowArgs<TConfig, TWorkflowType, TypedWorkflowOptions<TConfig>>,
  ) => Promise<TypedWorkflowHandleWithFirstExecutionRunId<TConfig, TWorkflowType>>;
};

/**
 * See https://docs.temporal.io/visibility#default-search-attributes
 */
export type SearchAttributeTypes<TConfig extends NamespaceConfiguration> = {
  [TSearchAttribute in keyof TConfig["searchAttributes"]]: SearchAttributeTypeToTSType<
    TConfig["searchAttributes"][TSearchAttribute]
  >;
} & {
  BatcherUser: string;
  CloseTime: Date;
  ExecutionDuration: number;
  ExecutionStatus: ExecutionStatus;
  ExecutionTime: Date;
  HistoryLength: number;
  HistorySizeBytes: number;
  RunId: string;
  StartTime: Date;
  StateTransitionCount: number;
  TaskQueue: TConfig["taskQueues"][number] | (string & {});
  TemporalScheduledStartTime: Date;
  TemporalScheduledById: string;
  TemporalSchedulePaused: boolean;
  WorkflowId: string;
  WorkflowType: keyof TConfig["workflows"];
};

/**
 * Execution status of a workflow as used in the `ExecutionStatus` search attribute
 */
export type ExecutionStatus =
  | "Running"
  | "Completed"
  | "Failed"
  | "Canceled"
  | "Terminated"
  | "ContinuedAsNew"
  | "TimedOut";

export type TypedWorkflowOptions<TConfig extends NamespaceConfiguration> = Omit<
  WorkflowOptions,
  "searchAttributes" | "taskQueue"
> & {
  /**
   * Specifies additional indexed information to attach to the Workflow Execution. More info:
   * https://docs.temporal.io/docs/typescript/search-attributes
   *
   * Values are always converted using {@link JsonPayloadConverter}, even when a custom data converter is provided.
   */
  searchAttributes?: TypedSearchAttributes<TConfig>;
  /**
   * Task queue to use for Workflow tasks. It should match a task queue specified when creating a
   * `Worker` that hosts the Workflow code.
   */
  taskQueue: TConfig["taskQueues"][number] | (string & {});
};

export type TypedChildWorkflowOptions<TConfig extends NamespaceConfiguration> = Omit<
  ChildWorkflowOptions,
  "searchAttributes" | "taskQueue"
> & {
  /**
   * Specifies additional indexed information to attach to the Workflow Execution. More info:
   * https://docs.temporal.io/docs/typescript/search-attributes
   *
   * Values are always converted using {@link JsonPayloadConverter}, even when a custom data converter is provided.
   */
  searchAttributes?: TypedSearchAttributes<TConfig>;
  /**
   * Task queue to use for Workflow tasks. It should match a task queue specified when creating a
   * `Worker` that hosts the Workflow code.
   */
  taskQueue?: TConfig["taskQueues"][number] | (string & {});
};

export type TypedWorkflowSignalWithStartOptions<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
  TSignal extends TConfig["workflows"][TWorkflowType]["signals"] extends Record<
    string,
    SignalFunction
  >
    ? keyof TConfig["workflows"][TWorkflowType]["signals"]
    : never,
> = TypedWorkflowOptions<TConfig> & {
  /**
   * Name of signal
   */
  signal: TSignal;
  /**
   * Arguments to invoke the signal handler with
   */
  signalArgs: TConfig["workflows"][TWorkflowType]["signals"][TSignal] extends SignalFunction
    ? Parameters<TConfig["workflows"][TWorkflowType]["signals"][TSignal]>
    : never;
};

export type TypedChildWorkflowHandle<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = Omit<ChildWorkflowHandle<any>, "result" | "signal"> & {
  /**
   * Promise that resolves when Workflow execution completes
   */
  result: TypedResult<TConfig, TWorkflowType>;
  signal: TypedSignal<TConfig, TWorkflowType>;
};

export type TypedExternalWorkflowHandle<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = Omit<ExternalWorkflowHandle, "signal"> & {
  /**
   * Signal a running Workflow.
   */
  signal: TypedSignal<TConfig, TWorkflowType>;
};

export type TypedWorkflowHandle<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = Omit<WorkflowHandle, "query" | "result" | "signal"> & {
  /**
   * Query a running Workflow.
   */
  query: TypedQuery<TConfig, TWorkflowType>;
  /**
   * Promise that resolves when Workflow execution completes
   */
  result: TypedResult<TConfig, TWorkflowType>;
  /**
   * Signal a running Workflow.
   */
  signal: TypedSignal<TConfig, TWorkflowType>;
};

export type TypedWorkflowHandleWithFirstExecutionRunId<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = TypedWorkflowHandle<TConfig, TWorkflowType> & {
  /**
   * Run Id of the first Execution in the Workflow Execution Chain.
   */
  readonly firstExecutionRunId: string;
};

export type TypedResult<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = () => ReturnType<TConfig["workflows"][TWorkflowType]["fn"]>;

export type TypedSignal<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = TConfig["workflows"][TWorkflowType]["signals"] extends Record<string, SignalFunction>
  ? <TSignal extends keyof TConfig["workflows"][TWorkflowType]["signals"]>(
      signal: TSignal,
      ...args: Parameters<TConfig["workflows"][TWorkflowType]["signals"][TSignal]>
    ) => Promise<void>
  : never;

export type TypedQuery<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = TConfig["workflows"][TWorkflowType]["queries"] extends Record<string, QueryFunction>
  ? <TQuery extends keyof TConfig["workflows"][TWorkflowType]["queries"]>(
      query: TQuery,
      ...args: Parameters<TConfig["workflows"][TWorkflowType]["queries"][TQuery]>
    ) => ReturnType<TConfig["workflows"][TWorkflowType]["queries"][TQuery]>
  : never;

export type WithTypedWorkflowArgs<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
  T,
> = T & {
  /**
   * Arguments to pass to the Workflow function
   */
  args: Parameters<TConfig["workflows"][TWorkflowType]["fn"]>;
};

export type ToTuple<Tuple extends [...any[]]> = {
  [Index in keyof Tuple]: ZodType<Tuple[Index]>;
};

export type WorkflowArgumentZodSchemas<
  TConfig extends NamespaceConfiguration,
  TWorkflowType extends keyof TConfig["workflows"],
> = ToTuple<Parameters<TConfig["workflows"][TWorkflowType]["fn"]>>["length"] extends 0
  ? never
  : ToTuple<Parameters<TConfig["workflows"][TWorkflowType]["fn"]>>;
