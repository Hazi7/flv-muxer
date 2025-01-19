import { AmfType } from "../constants/amf-type";
import { ScriptEncoder } from "../core/script-encoder";

export interface ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder): void;
}

export class NullStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.NULL);
  }
}

export class UndefinedStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.UNDEFINED);
  }
}

export class BooleanStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.BOOLEAN);
    encoder.writeUint8(value ? 0x01 : 0x00);
  }
}

export class NumberStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.NUMBER);
    encoder.writeFloat64(value);
  }
}

export class StringStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.STRING);
    encoder.writeScriptDataString(value);
  }
}

export class LongStringStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.LONG_STRING);
    encoder.writeScriptDataLongString(value);
  }
}

export class DateStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.DATE);
    encoder.writeScriptDataDate(value);
  }
}

export class StrictArrayStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.STRICT_ARRAY);
    encoder.writeScriptDataStrictArray(value);
  }
}

export class EcmaArrayStrategy implements ScriptDataStrategy {
  write(value: any, encoder: ScriptEncoder) {
    encoder.writeUint8(AmfType.ECMA_ARRAY);
    encoder.writeScriptDataEcmaArray(value);
  }
}
