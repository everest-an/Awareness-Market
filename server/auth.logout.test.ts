import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });

    // Logout should clear 3 cookies: session cookie, jwt_token, and jwt_refresh
    expect(clearedCookies).toHaveLength(3);

    // Verify the session cookie is cleared
    const sessionCookie = clearedCookies.find(c => c.name === COOKIE_NAME);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });

    // Verify jwt_token and jwt_refresh are also cleared
    const jwtToken = clearedCookies.find(c => c.name === 'jwt_token');
    const jwtRefresh = clearedCookies.find(c => c.name === 'jwt_refresh');
    expect(jwtToken).toBeDefined();
    expect(jwtRefresh).toBeDefined();
    expect(jwtToken?.options.maxAge).toBe(-1);
    expect(jwtRefresh?.options.maxAge).toBe(-1);
  });
});
