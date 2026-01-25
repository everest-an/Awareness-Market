import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

function isLocalDevelopment(req: Request): boolean {
  const hostname = req.hostname || req.headers.host?.split(':')[0] || '';
  return LOCAL_HOSTS.has(hostname);
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  const isLocal = isLocalDevelopment(req);
  const isSecure = isSecureRequest(req);

  // For local development (HTTP), use sameSite: "lax" which works without HTTPS
  // For production (HTTPS), use sameSite: "none" with secure: true for cross-origin
  return {
    httpOnly: true,
    path: "/",
    sameSite: isLocal ? "lax" : (isSecure ? "none" : "lax"),
    secure: isSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}
