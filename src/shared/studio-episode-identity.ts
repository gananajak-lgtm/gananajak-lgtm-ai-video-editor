/** Refuse an episode file that already belongs to another episode. */
export function assertStudioEpisodeIdentity(documentId: string | undefined, episodeId: string): void {
  if (documentId?.startsWith("episode-") && documentId !== "episode-" + episodeId) {
    throw new Error("ไฟล์ไทม์ไลน์เป็นข้อมูลของ EP อื่น ยกเลิกการเปิดเพื่อป้องกันบันทึกข้อมูลทับผิดตอน");
  }
}
