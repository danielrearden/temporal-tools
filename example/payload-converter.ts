import { BigIntSerializer, CustomPayloadConverter } from "../src/payload-converter.js";

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
