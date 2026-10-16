import { NextRequest, NextResponse } from "next/server";
import { configuredOrigin } from "./lib/origins";
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/health") return NextResponse.next();
  let token = req.cookies.get("demo_session")?.value;
  let fresh = false;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token =
      crypto.randomUUID().replaceAll("-", "") +
      crypto.randomUUID().replaceAll("-", "");
    fresh = true;
    req.cookies.set("demo_session", token);
  }
  const res = NextResponse.next({ request: { headers: req.headers } });
  if (fresh)
    res.cookies.set("demo_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie(req),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  return res;
}
function secureCookie(req: NextRequest) {
  try {
    return (
      new URL(configuredOrigin(process.env.APP_ORIGIN ?? "")).protocol ===
      "https:"
    );
  } catch {
    return (
      process.env.NODE_ENV === "production" || req.nextUrl.protocol === "https:"
    );
  }
}
export const config = { matcher: ["/((?!_next|media|fonts|favicon.ico).*)"] };
