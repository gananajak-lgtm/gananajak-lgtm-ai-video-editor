import { copyFile } from "node:fs/promises";
import { constants } from "node:fs";

/** Materialize a validated MP3 without replacing any existing paid audio. */
export async function persistGeneratedMp3Exclusively(verifiedTemporaryPath: string, destinationPath: string): Promise<void> {
  // Unlike rename(), COPYFILE_EXCL fails if a previous take already exists.
  await copyFile(verifiedTemporaryPath, destinationPath, constants.COPYFILE_EXCL);
}
