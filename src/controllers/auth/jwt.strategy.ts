import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { OrganizationRepository } from '../../repositories/organization/organization.repository';
import { AuthenticatedUser, KeycloakJwtPayload } from 'src/types/auth/token';
import { Roles } from 'src/types/auth/enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly orgRepo: OrganizationRepository,
    private readonly config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: async (
        _req: any,
        rawToken: string,
        done: (err: Error | null, secret?: string) => void,
      ) => {
        try {
          const decoded = jwt.decode(rawToken, { complete: true }) as any;
          
          if (!decoded?.payload?.iss) return done(new Error('Missing issuer in token'));

          const realmName = decoded.payload.iss.split('/realms/')[1];
          const baseUrl = config.get<string>('KEYCLOAK_BASE_URL');
          const jwksUri = `${baseUrl}/realms/${realmName}/protocol/openid-connect/certs`;
          

          const kid = decoded.header?.kid;
          const client = new JwksClient({ jwksUri, cache: true, rateLimit: true });
          const key = await client.getSigningKey(kid);
          done(null, key.getPublicKey());
        } catch (err) {
          done(err as Error);
        }
      },
    });
  }

  async validate(payload: KeycloakJwtPayload): Promise<AuthenticatedUser> {
    const realmName = payload.iss.split('/realms/')[1];
    const org = await this.orgRepo.findByRealmName(realmName);
    if (!org) throw new UnauthorizedException('Organization not found for realm');

    const roles = (payload.realm_access?.roles ?? []) as unknown as Roles[];

    return {
      keycloakId: payload.sub,
      username: payload.preferred_username,
      organizationId: org.id,
      roles,
    };
  }
}
