import sharp, { type Metadata } from "sharp";

export const DAILY_REPORT_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const DAILY_REPORT_MAX_PHOTOS = 4;
export const LINE_FLEX_MAX_DIMENSION = 1024;

const ACCEPTED_IMAGES = {
  "image/jpeg": { extensions: ["jpg", "jpeg"], sourceExtension: "jpg" },
  "image/png": { extensions: ["png"], sourceExtension: "png" },
  "image/webp": { extensions: ["webp"], sourceExtension: "webp" },
  "image/gif": { extensions: ["gif"], sourceExtension: "gif" },
  "image/avif": { extensions: ["avif"], sourceExtension: "avif" },
  "image/heic": { extensions: ["heic"], sourceExtension: "heic" },
  "image/heif": { extensions: ["heif"], sourceExtension: "heif" },
  "image/tiff": { extensions: ["tif", "tiff"], sourceExtension: "tiff" },
  "image/bmp": { extensions: ["bmp"], sourceExtension: "bmp" },
} as const;

export type AcceptedDailyReportMime = keyof typeof ACCEPTED_IMAGES;

export type PreparedDailyReportImage = {
  sourceBuffer: Buffer;
  sourceContentType: AcceptedDailyReportMime;
  sourceExtension: string;
  lineBuffer: Buffer;
  lineContentType: "image/jpeg" | "image/png";
  lineExtension: "jpg" | "png";
  contentHash: string;
};
function filenameExtension(filename: string): string {
  const normalized = filename.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  if (dot <= 0 || dot === normalized.length - 1) return "";
  return normalized.slice(dot + 1);
}

async function sha256Hex(buffer: Buffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(buffer));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isAcceptedDailyReportMime(value: string): value is AcceptedDailyReportMime {
  return Object.prototype.hasOwnProperty.call(ACCEPTED_IMAGES, value);
}

function inferContentType(file: File, extension: string): AcceptedDailyReportMime | null {
  const declared = file.type.trim().toLowerCase();
  if (isAcceptedDailyReportMime(declared)) return declared;
  if (declared !== "" && declared !== "application/octet-stream") return null;

  const inferred = Object.entries(ACCEPTED_IMAGES).find(([, policy]) =>
    (policy.extensions as readonly string[]).includes(extension),
  )?.[0];
  return inferred && isAcceptedDailyReportMime(inferred) ? inferred : null;
}
export async function prepareDailyReportImage(file: File): Promise<PreparedDailyReportImage> {
  if (!(file instanceof File) || file.size <= 0) throw new Error("EMPTY_IMAGE");
  if (file.size > DAILY_REPORT_MAX_SOURCE_BYTES) throw new Error("IMAGE_TOO_LARGE");

  const extension = filenameExtension(file.name);
  const contentType = inferContentType(file, extension);
  if (!contentType) throw new Error("UNSUPPORTED_IMAGE_TYPE");

  const policy = ACCEPTED_IMAGES[contentType];
  if (!extension || !(policy.extensions as readonly string[]).includes(extension)) {
    throw new Error("IMAGE_EXTENSION_MISMATCH");
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(sourceBuffer, {
      animated: false,
      limitInputPixels: 64 * 1024 * 1024,
      failOn: "warning",
    }).metadata();
  } catch {
    throw new Error("INVALID_IMAGE_CONTENT");
  }
  if (!metadata.width || !metadata.height) throw new Error("INVALID_IMAGE_CONTENT");

  const decodedFormat = metadata.format?.toLowerCase() ?? "";
  const expectedFormats: Record<AcceptedDailyReportMime, readonly string[]> = {
    "image/jpeg": ["jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
    "image/avif": ["heif", "avif"],
    "image/heic": ["heif"],
    "image/heif": ["heif"],
    "image/tiff": ["tiff"],
    "image/bmp": ["bmp", "magick"],
  };
  if (!expectedFormats[contentType].includes(decodedFormat)) {
    throw new Error("IMAGE_CONTENT_TYPE_MISMATCH");
  }

  const base = sharp(sourceBuffer, {
    animated: false,
    limitInputPixels: 64 * 1024 * 1024,
    failOn: "warning",
  }).rotate().resize({
    width: LINE_FLEX_MAX_DIMENSION,
    height: LINE_FLEX_MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });
  let lineBuffer: Buffer;
  let lineContentType: "image/jpeg" | "image/png";
  let lineExtension: "jpg" | "png";

  if (contentType === "image/png") {
    lineBuffer = await base.png({ compressionLevel: 9, palette: true }).toBuffer();
    lineContentType = "image/png";
    lineExtension = "png";
  } else {
    lineBuffer = await base
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    lineContentType = "image/jpeg";
    lineExtension = "jpg";
  }

  if (lineBuffer.byteLength > 10 * 1024 * 1024) {
    throw new Error("LINE_IMAGE_TOO_LARGE");
  }

  return {
    sourceBuffer,
    sourceContentType: contentType,
    sourceExtension: policy.sourceExtension,
    lineBuffer,
    lineContentType,
    lineExtension,
    contentHash: await sha256Hex(sourceBuffer),
  };
}
