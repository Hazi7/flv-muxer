/**
 * AMF (Action Message Format) 数据类型枚举。
 */
export enum AmfType {
  /** 数字类型，值为 0x00 */
  NUMBER = 0x00,
  /** 布尔类型，值为 0x01 */
  BOOLEAN = 0x01,
  /** 字符串类型，值为 0x02 */
  STRING = 0x02,
  /** 对象类型，值为 0x03 */
  OBJECT = 0x03,
  /** MovieClip 类型，值为 0x04 */
  MOVIE_CLIP = 0x04,
  /** Null 类型，值为 0x05 */
  NULL = 0x05,
  /** Undefined 类型，值为 0x06 */
  UNDEFINED = 0x06,
  /** 引用类型，值为 0x07 */
  REFERENCE = 0x07,
  /** ECMA 数组类型，值为 0x08 */
  ECMA_ARRAY = 0x08,
  /** 对象结束标记，值为 0x09 */
  OBJECT_END_MARKER = 0x09,
  /** 严格数组类型，值为 0x0a */
  STRICT_ARRAY = 0x0a,
  /** 日期类型，值为 0x0b */
  DATE = 0x0b,
  /** 长字符串类型，值为 0x0c */
  LONG_STRING = 0x0c,
}
