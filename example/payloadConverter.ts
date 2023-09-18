import { BigIntSerializer, CustomPayloadConverter } from "../src/payloadConverter.js";

declare module "../src/types.js" {
  interface CustomDataConverterTypeMap {
    bigint: bigint;
  }
}

export const payloadConverter = new CustomPayloadConverter({
  serializers: {
    bigint: BigIntSerializer,
  },
});
