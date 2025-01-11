/**
 * 将 Uint8Array 转换为十六进制字符串表示
 * @param bytes - 要转换的 Uint8Array
 * @param uppercase - 是否使用大写字母表示十六进制（默认：true）
 * @returns 十六进制字符串表示
 */
export function toHexString(
  bytes: Uint8Array,
  uppercase: boolean = true
): string {
  const hexArray = Array.from(bytes).map((byte) => {
    // 将每个字节转换为两位十六进制字符串，不足两位时前面补0
    const hex = byte.toString(16).padStart(2, "0");
    return uppercase ? hex.toUpperCase() : hex;
  });

  return hexArray.join("");
}
