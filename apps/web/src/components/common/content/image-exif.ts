import ExifReader from "exifreader";

const MM_REGEX = /mm/gi;

export type { ExifData };
export { extractMetadataByPriority };
interface ExifData {
  model?: string;
  focalLength?: string;
  fNumber?: string;
  iso?: string;
  exposureTime?: string;
  lens?: string;
}

/**
 * 按可信度排序读取元数据的辅助函数
 * ExifReader expanded 模式返回结构: { exif: {...}, xmp: {...}, iptc: {...}, icc: {...}, mpf: {...} }
 * 优先级：XMP → EXIF → IPTC → MPF
 */
function extractMetadataByPriority(tags: ExifReader.ExpandedTags): ExifData {
  const fieldPriorities = {
    model: ["xmp.Model", "exif.Model", "exif.Make", "iptc.Model"],
    focalLength: ["xmp.FocalLength", "exif.FocalLength", "exif.FocalLengthIn35mmFilm"],
    fNumber: ["xmp.FNumber", "exif.FNumber", "exif.ApertureValue"],
    iso: ["xmp.ISO", "exif.ISOSpeedRatings", "exif.ISO", "exif.PhotographicSensitivity"],
    exposureTime: ["xmp.ExposureTime", "exif.ExposureTime", "exif.ShutterSpeedValue"],
    lens: ["xmp.LensModel", "exif.LensModel", "exif.LensInfo", "exif.Lens"],
  };

  const getValueByPriority = (candidates: string[]): string | undefined => {
    for (const candidate of candidates) {
      const parts = candidate.split(".");
      let value: unknown = tags;

      for (const part of parts) {
        if (value && typeof value === "object" && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          value = undefined;
          break;
        }
      }

      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if ("description" in obj && obj.description) {
          const desc = String(obj.description).trim();
          if (desc && desc !== "undefined")
            return desc;
        }
        if ("value" in obj && obj.value !== undefined && obj.value !== null) {
          const val = String(obj.value).trim();
          if (val && val !== "undefined")
            return val;
        }
      }
    }
    return undefined;
  };

  const model = getValueByPriority(fieldPriorities.model);
  const focalLengthRaw = getValueByPriority(fieldPriorities.focalLength);
  const focalLength = focalLengthRaw ? `${focalLengthRaw.replace(MM_REGEX, "").trim()}mm` : undefined;
  const fNumber = getValueByPriority(fieldPriorities.fNumber);
  const iso = getValueByPriority(fieldPriorities.iso);
  const exposureTime = getValueByPriority(fieldPriorities.exposureTime);
  const lens = getValueByPriority(fieldPriorities.lens);

  return { model, focalLength, fNumber, iso, exposureTime, lens };
}
