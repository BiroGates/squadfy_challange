import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { Roles } from 'src/types/auth/enum';
import { TokenResponse } from 'src/types/auth/token';

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private readonly kcAdmin: KcAdminClient;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('KEYCLOAK_BASE_URL')!;
    this.kcAdmin = new KcAdminClient({ baseUrl: this.baseUrl, realmName: 'master' });
  }

  async auth(): Promise<void> {
    await this.kcAdmin.auth({
      grantType: 'password',
      clientId: 'admin-cli',
      username: this.config.get<string>('KEYCLOAK_ADMIN_USER')!,
      password: this.config.get<string>('KEYCLOAK_ADMIN_PASSWORD')!,
    });
  }

  async createRealm(realmName: string): Promise<void> {
    await this.auth();
    await this.kcAdmin.realms.create({ realm: realmName, enabled: true });

    await this.kcAdmin.clients.create({
      realm: realmName,
      clientId: 'knowledge-api',
      enabled: true,
      directAccessGrantsEnabled: true,
      publicClient: true,
    });

    // Create realm roles
    for (const role of Object.values(Roles) as string[]) {
      await this.kcAdmin.roles.create({ realm: realmName, name: role });
    }

    this.logger.log(`Realm '${realmName}' created with roles and client.`);
  }

  async createUser(
    realmName: string,
    username: string,
    password: string,
    role: string,
  ): Promise<string> {
    await this.auth();

    const { id: userId } = await this.kcAdmin.users.create({
      realm: realmName,
      username,
      enabled: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    });

    const realmRole = await this.kcAdmin.roles.findOneByName({ realm: realmName, name: role });
    if (realmRole) {
      await this.kcAdmin.users.addRealmRoleMappings({
        realm: realmName,
        id: userId!,
        roles: [{ id: realmRole.id!, name: realmRole.name! }],
      });
    }

    this.logger.log(`User '${username}' created in realm '${realmName}' with role '${role}'.`);
    return userId!;
  }

  async login(realmName: string, username: string, password: string): Promise<TokenResponse> {
    const url = `${this.baseUrl}/realms/${realmName}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: 'knowledge-api',
      username,
      password,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Keycloak login failed: ${text}`);
    }

    return response.json() as Promise<TokenResponse>;
  }
}
