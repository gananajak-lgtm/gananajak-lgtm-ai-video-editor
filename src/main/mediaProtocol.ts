import { net, protocol } from "electron";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const MEDIA_SCHEME = "editor-media";
const MAX_PLAYBACK_TOKENS = 16;
const playbackFiles = new Map<string, string>();

protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true
    }
  }
]);

export function installMediaProtocol() {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const url = new URL(request.url);
    const token = url.pathname.replace(/^\/+/, "");
    const filePath = playbackFiles.get(token);

    if (!filePath) {
      return new Response("Preview media token is no longer available.", {
        status: 404
      });
    }

    return net.fetch(pathToFileURL(filePath).toString(), {
      headers: request.headers
    });
  });
}

export function createPlaybackUrl(filePath: string) {
  const token = randomUUID();
  playbackFiles.set(token, filePath);

  while (playbackFiles.size > MAX_PLAYBACK_TOKENS) {
    const oldest = playbackFiles.keys().next().value;
    if (!oldest) break;
    playbackFiles.delete(oldest);
  }

  return `${MEDIA_SCHEME}://preview/${token}`;
}
