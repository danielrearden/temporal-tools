import { ClientOptions, Client } from "@temporalio/client";
import { NamespaceConfiguration, TypedClient } from "./types.js";

/**
 * Creates a type-safe instance of a Temporal client specific to the provided namespace configuration.
 */
export const createClient = <TConfig extends NamespaceConfiguration>(
  /**
   * Client options. Note: The `namespace` is automatically set to the namespace of the configuration.
   */
  options?: Omit<ClientOptions, "namespace"> & { namespace: TConfig["namespace"] },
): TypedClient<TConfig> => {
  return new Client({ ...options }) as any;
};
