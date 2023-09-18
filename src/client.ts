import { type ClientOptions, Client } from "@temporalio/client";
import { type NamespaceConfiguration, type TypedClient } from "./types.js";

/**
 * Creates a type-safe instance of a Temporal client specific to the provided namespace configuration.
 */
export const createClient = <TConfig extends NamespaceConfiguration>(
  /**
   * Namespace configuration
   */
  config: TConfig,
  /**
   * Client options. Note: The `namespace` is automatically set to the namespace of the configuration.
   */
  options?: Omit<ClientOptions, "namespace">,
): TypedClient<TConfig> => {
  return new Client({ ...options, namespace: config.namespace }) as any;
};
