import assert from "node:assert";
import { describe, test } from "node:test";
import { BigIntSerializer, CustomPayloadConverter } from "../src/payload-converter.js";

declare module "../src/types.js" {
  interface CustomDataConverterTypeMap {
    bigint: bigint;
  }
}

describe("CustomPayloadConverter", () => {
  test("converts to and from payload", () => {
    const dataConverter = new CustomPayloadConverter({
      serializers: {
        bigint: BigIntSerializer,
      },
    });

    const data = {
      a: BigInt(123),
      b: {
        c: 456n,
        d: "789",
      },
      e: null,
    };
    const payload = dataConverter.toPayload(data);
    assert.notStrictEqual(payload, undefined);
    const result = dataConverter.fromPayload(payload!);
    assert.deepEqual(result, data);
  });
});
