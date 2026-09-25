import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

export type OAuthCallback = { code:string; state:string; redirectUri:string };

export function createOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function waitForOAuthCallback(expectedState:string, timeoutMs=120_000): Promise<OAuthCallback> {
  return new Promise((resolve,reject) => {
    const server=createServer((req,res) => {
      const address=server.address();
      if (!address || typeof address === "string") return;
      const url=new URL(req.url ?? "/", `http://127.0.0.1:${address.port}`);
      const error=url.searchParams.get("error");
      const code=url.searchParams.get("code");
      const state=url.searchParams.get("state");
      if (error) { res.end("Authorization was not completed. You can close this window."); cleanup(); reject(new Error(error)); return; }
      if (!code || !state || state !== expectedState) { res.statusCode=400; res.end("Invalid OAuth callback. You can close this window."); cleanup(); reject(new Error("Invalid OAuth callback state.")); return; }
      res.end("YouTube connected. You can return to Gananajak AI Video Editor.");
      const redirectUri=`http://127.0.0.1:${address.port}`;
      cleanup(); resolve({code,state,redirectUri});
    });
    const timer=setTimeout(() => { server.close(); reject(new Error("OAuth authorization timed out.")); }, timeoutMs);
    const cleanup=()=>{ clearTimeout(timer); server.close(); };
    server.listen(0,"127.0.0.1");
  });
}
