/** Lightweight MP3 signature screening; full decoding is still required to prove playability. */
export function hasPlausibleMp3Header(header: Uint8Array): boolean {
  if (header.length < 4) return false;
  const id3 = header.length >= 10 &&
    header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33 &&
    header[3] >= 2 && header[3] <= 4 && header[4] !== 0xff &&
    [6, 7, 8, 9].every(index => (header[index] & 0x80) === 0);
  const mpeg = header[0] === 0xff && (header[1] & 0xe0) === 0xe0 &&
    ((header[1] >> 3) & 0x03) !== 0x01 &&
    ((header[1] >> 1) & 0x03) !== 0x00 &&
    ((header[2] >> 4) & 0x0f) !== 0x0f &&
    ((header[2] >> 2) & 0x03) !== 0x03;
  return id3 || mpeg;
}
