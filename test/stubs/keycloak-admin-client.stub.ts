// Test-only stub for @keycloak/keycloak-admin-client.
// The real package ships ESM (kiota / url-template) which Jest cannot parse.
// We never exercise the real client in unit tests — KeycloakService is always mocked —
// so a no-op stub is enough.
export default class KcAdminClient {
  constructor(_opts?: any) {}
  async auth(_opts?: any): Promise<void> {}
  realms = { create: async (_opts?: any) => undefined };
  clients = { create: async (_opts?: any) => undefined };
  roles = {
    create: async (_opts?: any) => undefined,
    findOneByName: async (_opts?: any) => null,
  };
  users = {
    create: async (_opts?: any) => ({ id: 'stub-user-id' }),
    find: async (_opts?: any) => [],
    addRealmRoleMappings: async (_opts?: any) => undefined,
  };
}
