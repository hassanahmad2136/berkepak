import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase server module before importing the module under test
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(),
  createSupabaseAdmin: vi.fn(),
}));

import { isCurrentUserAdmin, isAdminEmail } from "@/lib/admin";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";

const mockCreateSupabaseServer = vi.mocked(createSupabaseServer);
const mockCreateSupabaseAdmin = vi.mocked(createSupabaseAdmin);

// Helper to build a mock Supabase server client
function makeServerClient(user: { id: string; email?: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as any;
}

// Helper to build a mock admin client with a chainable query builder
function makeAdminClient(result: { data: any; error: any }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn().mockReturnValue(chain),
  } as any;
}

describe("isAdminEmail", () => {
  it("returns false for null email", () => {
    expect(isAdminEmail(null)).toBe(false);
  });

  it("returns false for undefined email", () => {
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

describe("isCurrentUserAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset ADMIN_EMAILS so tests are deterministic
    delete process.env.ADMIN_EMAILS;
  });

  it("returns false when no user is authenticated", async () => {
    mockCreateSupabaseServer.mockResolvedValue(makeServerClient(null));
    // Admin client won't be called, but set it up anyway
    mockCreateSupabaseAdmin.mockReturnValue(makeAdminClient({ data: null, error: null }));

    const result = await isCurrentUserAdmin();
    expect(result).toBe(false);
  });

  it("returns true when user email is in ADMIN_EMAILS list", async () => {
    process.env.ADMIN_EMAILS = "admin@berkepak.com,super@berkepak.com";
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "user-1", email: "admin@berkepak.com" }),
    );
    // Admin client shouldn't be called because email check short-circuits
    mockCreateSupabaseAdmin.mockReturnValue(makeAdminClient({ data: null, error: null }));

    const result = await isCurrentUserAdmin();
    expect(result).toBe(true);
  });

  it("returns false when user email is NOT in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "admin@berkepak.com";
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "user-2", email: "regular@example.com" }),
    );
    // admin_users lookup also finds nothing
    mockCreateSupabaseAdmin.mockReturnValue(makeAdminClient({ data: null, error: null }));

    const result = await isCurrentUserAdmin();
    expect(result).toBe(false);
  });

  it("returns true when user_id is found in admin_users table", async () => {
    process.env.ADMIN_EMAILS = ""; // empty list — email check won't pass
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "db-admin-user", email: "someuser@example.com" }),
    );
    // admin_users lookup returns a row
    mockCreateSupabaseAdmin.mockReturnValue(
      makeAdminClient({ data: { user_id: "db-admin-user" }, error: null }),
    );

    const result = await isCurrentUserAdmin();
    expect(result).toBe(true);
  });

  it("returns false when admin_users lookup returns an error", async () => {
    process.env.ADMIN_EMAILS = "";
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "user-3", email: "user@example.com" }),
    );
    mockCreateSupabaseAdmin.mockReturnValue(
      makeAdminClient({ data: null, error: { message: "DB connection error" } }),
    );

    const result = await isCurrentUserAdmin();
    expect(result).toBe(false);
  });

  it("returns false when admin_users lookup returns null (not found)", async () => {
    process.env.ADMIN_EMAILS = "";
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "user-4", email: "user@example.com" }),
    );
    mockCreateSupabaseAdmin.mockReturnValue(
      makeAdminClient({ data: null, error: null }),
    );

    const result = await isCurrentUserAdmin();
    expect(result).toBe(false);
  });
});
