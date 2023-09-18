import { createActivityFactory } from "./helpers.js";

export const sayHello = createActivityFactory("sayHello", () => {
  return async ({ name }) => {
    return `Hello, ${name}!`;
  };
});

export const scoped$doSomething = createActivityFactory("scoped$doSomething", () => {
  return async () => {
    return 42;
  };
});
