import {
  encodingKeys,
  encodingTypes,
  CompositePayloadConverter,
  METADATA_ENCODING_KEY,
  Payload,
  PayloadConverterWithEncoding,
  UndefinedPayloadConverter,
  ValueError,
} from "@temporalio/common";
import { decode, encode } from "@temporalio/common/lib/encoding.js";
import { z } from "zod";
import { CustomDataConverterSerializer, CustomDataConverterSerializers, Json } from "./types.js";

export class CustomPayloadConverter extends CompositePayloadConverter {
  public constructor(options: {
    /**
     * The key used when serializing custom types. Defaults to `@serialized`.
     */
    serializationKey?: string;
    /**
     * A map of serializer objects used to serialize and deserialize custom types.
     */
    serializers: CustomDataConverterSerializers;
  }) {
    super(new UndefinedPayloadConverter(), new CustomJsonPayloadConverter(options));
  }
}

export class CustomJsonPayloadConverter implements PayloadConverterWithEncoding {
  public readonly encodingType = encodingTypes.METADATA_ENCODING_JSON;
  public readonly serializers: CustomDataConverterSerializers;
  public readonly serializationKey: string;

  public constructor(options: {
    serializationKey?: string;
    serializers: CustomDataConverterSerializers;
  }) {
    this.serializers = options.serializers;
    this.serializationKey = options.serializationKey ?? "@serialized";
  }

  public toPayload(value: unknown): Payload | undefined {
    if (value === undefined) {
      return undefined;
    }

    let json;
    try {
      json = JSON.stringify(value, this.replacer.bind(this));
    } catch (err) {
      return undefined;
    }

    return {
      metadata: {
        [METADATA_ENCODING_KEY]: encodingKeys.METADATA_ENCODING_JSON,
      },
      data: encode(json),
    };
  }

  public fromPayload<T>(content: Payload): T {
    if (content.data === undefined || content.data === null) {
      throw new ValueError("Got payload with no data");
    }

    return JSON.parse(decode(content.data), this.reviver.bind(this));
  }

  private replacer(key: string, value: any): any {
    if (value === undefined) {
      return undefined;
    }

    for (const [typeName, { isTypeOf, serialize }] of Object.entries<
      CustomDataConverterSerializer<any>
    >(this.serializers)) {
      if (isTypeOf(value)) {
        return {
          [this.serializationKey]: {
            type: typeName,
            value: serialize(value),
          },
        };
      }
    }

    return value;
  }

  private reviver(key: string, value: any): any {
    if (typeof value === "object" && value !== null && this.serializationKey in value) {
      const { type: typeName, value: serialized } = value[this.serializationKey];
      const serializer: CustomDataConverterSerializer<any> =
        this.serializers[typeName as keyof CustomDataConverterSerializers];
      if (serializer !== undefined) {
        return serializer.deserialize(serialized);
      }
    }

    return value;
  }
}

export const createCustomDataConverterSerializer = <TType, TSerialized extends Json>({
  isTypeOf,
  serialize,
  deserialize,
}: {
  isTypeOf: (value: unknown) => boolean;
  serialize: (value: TType) => TSerialized;
  deserialize: (serialized: TSerialized) => TType;
}): CustomDataConverterSerializer<TType> => ({
  isTypeOf,
  serialize,
  deserialize,
  zodType: z.custom<TType>(isTypeOf),
});

export const BigIntSerializer = createCustomDataConverterSerializer<bigint, string>({
  isTypeOf: (value) => typeof value === "bigint",
  serialize: (value) => value.toString(),
  deserialize: (serialized) => BigInt(serialized),
});

export const DateSerializer = createCustomDataConverterSerializer<Date, string>({
  isTypeOf: (value) => value instanceof Date,
  serialize: (value) => value.toISOString(),
  deserialize: (serialized) => new Date(serialized),
});

export const URLSerializer = createCustomDataConverterSerializer<URL, string>({
  isTypeOf: (value) => value instanceof URL,
  serialize: (value) => value.toString(),
  deserialize: (serialized) => new URL(serialized),
});

export const RegExpSerializer = createCustomDataConverterSerializer<RegExp, string>({
  isTypeOf: (value) => value instanceof RegExp,
  serialize: (value) => value.toString(),
  deserialize: (serialized) => new RegExp(serialized),
});
