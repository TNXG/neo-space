export interface ZipFile {
  path: string;
  content: string;
}

const textEncoder = new TextEncoder();

/** 构建 CRC32 查询表，减少归档大量正文时的重复位运算。 */
const createCrc32Table = (): Uint32Array => {
  const table = new Uint32Array(256);

  for (let index = 0; index < table.length; index += 1) {
    let checksum = index;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = checksum & 1
        ? 0xEDB88320 ^ (checksum >>> 1)
        : checksum >>> 1;
    }
    table[index] = checksum >>> 0;
  }

  return table;
};

const CRC32_TABLE = createCrc32Table();

/** 计算 ZIP 文件头要求的 CRC32 校验值。 */
const calculateCrc32 = (bytes: Uint8Array): number => {
  let checksum = 0xFFFFFFFF;

  for (const byte of bytes) {
    checksum = CRC32_TABLE[(checksum ^ byte) & 0xFF] ^ (checksum >>> 8);
  }

  return (checksum ^ 0xFFFFFFFF) >>> 0;
};

/** 将日期转换为 ZIP 使用的 DOS 日期与时间字段。 */
const toDosDateTime = (date: Date): { dosDate: number; dosTime: number } => {
  const year = Math.max(date.getFullYear(), 1980);

  return {
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  };
};

/** 把多个字节数组连续写入一个新的字节数组。 */
const concatenateBytes = (chunks: Uint8Array[]): Uint8Array => {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
};

/**
 * 创建无需第三方依赖的 ZIP 文件。
 *
 * 归档使用 STORE 模式保存 Markdown，避免压缩过程阻塞管理后台主线程。
 */
export const createZipBlob = (files: ZipFile[]): Blob => {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const { dosDate, dosTime } = toDosDateTime(new Date());
  let localOffset = 0;

  for (const file of files) {
    const fileName = textEncoder.encode(file.path);
    const content = textEncoder.encode(file.content);
    const checksum = calculateCrc32(content);
    const localHeader = new Uint8Array(30 + fileName.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034B50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, fileName.length, true);
    localHeader.set(fileName, 30);

    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014B50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, fileName.length, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(fileName, 46);

    localChunks.push(localHeader, content);
    centralChunks.push(centralHeader);
    localOffset += localHeader.length + content.length;
  }

  const centralDirectory = concatenateBytes(centralChunks);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054B50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);

  const archive = concatenateBytes([...localChunks, centralDirectory, endRecord]);
  const archiveBuffer = new ArrayBuffer(archive.byteLength);
  new Uint8Array(archiveBuffer).set(archive);
  return new Blob([archiveBuffer], { type: "application/zip" });
};
