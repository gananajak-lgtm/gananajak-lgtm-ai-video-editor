import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function assertApprovedMyCutMp3Hashes(files: string[], expectedHashes: string[]): Promise<void> {
  if (!Array.isArray(files) || !Array.isArray(expectedHashes) ||
      files.length === 0 || files.length !== expectedHashes.length || files.length > 10000 ||
      files.some(file => typeof file !== "string" || !file) ||
      expectedHashes.some(hash => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("Invalid MyCut approved MP3 fingerprints");
  }
  for (let i = 0; i < files.length; i++) {
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(files[i])) digest.update(chunk);
    if (digest.digest("hex") !== expectedHashes[i]) {
      throw new Error("MyCut MP3 changed before project serialization; review again");
    }
  }
}
