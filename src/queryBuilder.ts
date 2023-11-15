import { NamespaceConfiguration, SearchAttributeTypes } from "./types.js";

class ListFilterQueryBuilderImplementation<TConfig extends NamespaceConfiguration> {
  #expressions: string[] = [];

  /**
   * Appends a query expression to the query string for the provided attribute.
   * If this method is called multiple times, the expressions are combined with a logical AND.
   */
  where<TAttribute extends keyof SearchAttributeTypes<TConfig>>(
    attribute: TAttribute,
  ): {
    eq: (
      value: SearchAttributeTypes<TConfig>[TAttribute],
    ) => ListFilterQueryBuilderImplementation<TConfig>;
    ne: (
      value: SearchAttributeTypes<TConfig>[TAttribute],
    ) => ListFilterQueryBuilderImplementation<TConfig>;
    lt: (
      value: SearchAttributeTypes<TConfig>[TAttribute],
    ) => ListFilterQueryBuilderImplementation<TConfig>;
    lte: (
      value: SearchAttributeTypes<TConfig>[TAttribute],
    ) => ListFilterQueryBuilderImplementation<TConfig>;
    gt: (
      value: SearchAttributeTypes<TConfig>[TAttribute],
    ) => ListFilterQueryBuilderImplementation<TConfig>;
    gte: (
      value: SearchAttributeTypes<TConfig>[TAttribute],
    ) => ListFilterQueryBuilderImplementation<TConfig>;
    in: (
      values: SearchAttributeTypes<TConfig>[TAttribute][],
    ) => ListFilterQueryBuilderImplementation<TConfig>;
    between: (
      lower: SearchAttributeTypes<TConfig>[TAttribute],
      upper: SearchAttributeTypes<TConfig>[TAttribute],
    ) => ListFilterQueryBuilderImplementation<TConfig>;
  } {
    return {
      /**
       * Equivalent to `attribute = value`
       */
      eq: (value) => {
        this.#expressions.push(`${String(attribute)} = ${this.#formatValue(value)}`);
        return this;
      },
      /**
       * Equivalent to `attribute != value`
       */
      ne: (value) => {
        this.#expressions.push(`${String(attribute)} != ${this.#formatValue(value)}`);
        return this;
      },
      /**
       * Equivalent to `attribute < value`
       */
      lt: (value) => {
        this.#expressions.push(`${String(attribute)} < ${this.#formatValue(value)}`);
        return this;
      },
      /**
       * Equivalent to `attribute <= value`
       */
      lte: (value) => {
        this.#expressions.push(`${String(attribute)} <= ${this.#formatValue(value)}`);
        return this;
      },
      /**
       * Equivalent to `attribute > value`
       */
      gt: (value) => {
        this.#expressions.push(`${String(attribute)} > ${this.#formatValue(value)}`);
        return this;
      },
      /**
       * Equivalent to `attribute >= value`
       */
      gte: (value) => {
        this.#expressions.push(`${String(attribute)} >= ${this.#formatValue(value)}`);
        return this;
      },
      /**
       * Equivalent to `attribute IN (values)`
       */
      in: (values) => {
        this.#expressions.push(
          `${String(attribute)} IN (${values.map(this.#formatValue).join(", ")})`,
        );
        return this;
      },
      /**
       * Equivalent to `attribute BETWEEN lower AND upper`
       */
      between: (lower, upper) => {
        this.#expressions.push(
          `${String(attribute)} BETWEEN ${this.#formatValue(lower)} AND ${this.#formatValue(
            upper,
          )}`,
        );
        return this;
      },
    };
  }

  #formatValue = (value: any): string => {
    if (typeof value === "string") {
      return `'${value}'`;
    } else if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }

    return value;
  };

  /**
   * Combines the provided query builders with a logical AND.
   */
  and(queries: ListFilterQueryBuilderImplementation<TConfig>[]) {
    this.#expressions.push("(" + queries.map((query) => query.build()).join(" AND ") + ")");
    return this;
  }

  /**
   * Combines the provided query builders with a logical OR.
   */
  or(queries: ListFilterQueryBuilderImplementation<TConfig>[]) {
    this.#expressions.push("(" + queries.map((query) => query.build()).join(" OR ") + ")");
    return this;
  }

  /**
   * Returns a List Filter string that can be passed to the the workflow client's `list` method.
   */
  build(): string {
    return this.#expressions.join(" AND ");
  }
}

/**
 * Returns an instance of a query builder for the provided namespace configuration. The query builder
 * can be used to construct List Filters used with the Visibility List API.
 *
 * See https://docs.temporal.io/visibility#list-filter
 */
export const createListFilterQueryBuilder = <TConfig extends NamespaceConfiguration>() => {
  return class ListFilterQueryBuilder extends ListFilterQueryBuilderImplementation<TConfig> {};
};
