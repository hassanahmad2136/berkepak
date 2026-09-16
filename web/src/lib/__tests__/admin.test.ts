import { describe, it, expect, vi, beforeEach } from "vitest";

// The db module is server-only and opens a real pool; stub it before import.
vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  pool: {},
}));

vi.mock("@/lib/auth/session", () => ({
  readSession: vi.fn(),
  SESSION_COOKIE: "bp_session",
}));

import { isAdmin, isAdminEmail } from "@/lib/auth/guards";
import { queryOne } from "@/lib/db";

const mockQueryOne = vi.mocked(queryOne);

const user = (email: string) => ({
  id: "11111111-1111-4111-8111-111111111111",
  email,
  fullName: null,
  phone: null,
  emailVerifiedAt: new Date(),
});

describe("isAdminEmail", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("returns false for null email", () => {
    expect(isAdminEmail(null)).toBe(false);
  });

  it("returns false for undefined email", () => {
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("matches allowlisted addresses case-insensitively", () => {
    process.env.ADMIN_EMAILS = "Boss@berkepak.test, other@berkepak.test";
    expect(isAdminEmail("boss@BERKEPAK.test")).toBe(true);
  });

  it("returns false for an address not on the list", () => {
    process.env.ADMIN_EMAILS = "boss@berkepak.test";
    expect(isAdminEmail("customer@berkepak.test")).toBe(false);
  });
});

describe("isAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_EMAILS;
  });

  it("returns false when nobody is signed in", async () => {
    expect(await isAdmin(null)).toBe(false);
  });

  it("grants access via the ADMIN_EMAILS allowlist without touching the database", async () => {
    process.env.ADMIN_EMAILS = "boss@berkepak.test";
    expect(await isAdmin(user("boss@berkepak.test"))).toBe(true);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it("grants access via an admin_users row", async () => {
    mockQueryOne.mockResolvedValue({ user_id: "11111111-1111-4111-8111-111111111111" });
    expect(await isAdmin(user("customer@berkepak.test"))).toBe(true);
  });

  it("denies a user who is on neither", async () => {
    mockQueryOne.mockResolvedValue(null);
    expect(await isAdmin(user("customer@berkepak.test"))).toBe(false);
  });
});
