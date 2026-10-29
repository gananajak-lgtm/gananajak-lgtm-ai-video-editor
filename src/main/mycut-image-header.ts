import { open } from "node:fs/promises";
import path from "node:path";

/** Fast magic-header preflight. Does not replace actual image decoding in MyCut. */
export async function assertMyCutImageHeader(file: string): Promise<void> {
  const extension = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp", ".bmp"].includes(extension)) {
    throw new Error("Unsupported MyCut image format");
  }
  const handle = await open(file, "r");
  let header: Buffer;
  try {
    header = Buffer.alloc(16);
    const result = await handle.read(header, 0, 16, 0);
    if (result.bytesRead < 12) throw new Error("Invalid MyCut image header: " + path.basename(file));
  } finally {
    await handle.close();
  }
  const png = header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const webp = header.toString("ascii",0,4) === "RIFF" && header.toString("ascii",8,12) === "WEBP";
  const bmp = header.toString("ascii",0,2) === "BM";
  const valid = extension === ".png" ? png : extension === ".jpg" || extension === ".jpeg" ? jpeg :
    extension === ".webp" ? webp : bmp;
  if (!valid) throw new Error("Invalid MyCut image header: " + path.basename(file));
}
