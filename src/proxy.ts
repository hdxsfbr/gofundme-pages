import { NextRequest, NextResponse } from "next/server";
export function proxy(req: NextRequest) {
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
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  return res;
}
export const config = { matcher: ["/((?!_next|media|fonts|favicon.ico).*)"] };
