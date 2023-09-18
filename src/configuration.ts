import { type NamespaceConfiguration } from "./types.js";

/**
 * Utility for creating the configuration object for a namespace.
 */
export const createTemporalConfiguration = <TConfig extends NamespaceConfiguration>(
  config: TConfig,
): TConfig => {
  return config;
};
