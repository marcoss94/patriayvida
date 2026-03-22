import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAdminAccess, hasAdminEmailAccess, resolveIsAdmin } from "@/lib/admin-auth";

function createSupabaseStub(params: {
  profileIsAdmin?: boolean | null;
  user: { id: string; email?: string | null } | null;
}) {
  let profileQueryCount = 0;

  return {
    client: {
      auth: {
        async getUser() {
          return {
            data: {
              user: params.user,
            },
          };
        },
      },
      from(table: "profiles") {
        assert.equal(table, "profiles");

        return {
          select(columns: string) {
            assert.equal(columns, "is_admin");

            return {
              eq(column: "id", value: string) {
                assert.equal(column, "id");
                assert.equal(value, params.user?.id);

                return {
                  async maybeSingle() {
                    profileQueryCount += 1;

                    return {
                      data:
                        params.profileIsAdmin === undefined
                          ? null
                          : { is_admin: params.profileIsAdmin },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
    getProfileQueryCount() {
      return profileQueryCount;
    },
  };
}

describe("admin auth", () => {
  it("matches configured admin emails case-insensitively", () => {
    assert.equal(hasAdminEmailAccess(" Admin@Example.com ", "admin@example.com"), true);
    assert.equal(hasAdminEmailAccess("user@example.com", "admin@example.com"), false);
  });

  it("treats either configured admin email or profile flag as admin", () => {
    assert.equal(
      resolveIsAdmin({
        userEmail: "admin@example.com",
        configuredAdminEmail: "admin@example.com",
        profileIsAdmin: false,
      }),
      true
    );
    assert.equal(
      resolveIsAdmin({
        userEmail: "user@example.com",
        configuredAdminEmail: "admin@example.com",
        profileIsAdmin: true,
      }),
      true
    );
    assert.equal(
      resolveIsAdmin({
        userEmail: "user@example.com",
        configuredAdminEmail: "admin@example.com",
        profileIsAdmin: false,
      }),
      false
    );
  });

  it("grants admin access from configured admin email without querying profiles", async () => {
    const supabase = createSupabaseStub({
      user: { id: "user-1", email: "ADMIN@example.com" },
    });

    const result = await getAdminAccess({
      supabase: supabase.client,
      configuredAdminEmail: "admin@example.com",
    });

    assert.equal(result.isAdmin, true);
    assert.equal(supabase.getProfileQueryCount(), 0);
  });

  it("falls back to the profile admin flag when needed", async () => {
    const supabase = createSupabaseStub({
      user: { id: "user-2", email: "user@example.com" },
      profileIsAdmin: true,
    });

    const result = await getAdminAccess({
      supabase: supabase.client,
      configuredAdminEmail: "admin@example.com",
    });

    assert.equal(result.isAdmin, true);
    assert.equal(supabase.getProfileQueryCount(), 1);
  });

  it("rejects users when neither admin rule matches", async () => {
    const supabase = createSupabaseStub({
      user: { id: "user-3", email: "user@example.com" },
      profileIsAdmin: false,
    });

    const result = await getAdminAccess({
      supabase: supabase.client,
      configuredAdminEmail: "admin@example.com",
    });

    assert.equal(result.isAdmin, false);
    assert.equal(supabase.getProfileQueryCount(), 1);
  });
});
