import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { KeycloakService } from '../keycloak/keycloak.service';
import { OrganizationRepository } from '../../repositories/organization/organization.repository';
import { Organization } from '../../../infra/db/schema';
import { TokenResponse } from 'src/types/auth/token';

describe('AuthService', () => {
  let service: AuthService;
  let keycloakService: jest.Mocked<KeycloakService>;
  let organizationRepository: jest.Mocked<OrganizationRepository>;

  beforeEach(() => {
    keycloakService = { login: jest.fn() } as any;
    organizationRepository = { findById: jest.fn() } as any;
    service = new AuthService(keycloakService, organizationRepository);
  });

  it('throws NotFoundException when the organizationId is not registered', async () => {
    organizationRepository.findById.mockResolvedValue(null);

    await expect(service.login('org-missing', 'alice', 'pw')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(keycloakService.login).not.toHaveBeenCalled();
  });

  it('resolves the realm via DB and delegates the credential check to Keycloak', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: 'org-A',
      realmName: 'techcorp',
    } as Organization);
    const token: TokenResponse = {
      access_token: 'eyJ...',
      expires_in: 300,
      token_type: 'Bearer',
    };
    keycloakService.login.mockResolvedValue(token);

    const result = await service.login('org-A', 'alice', 'pw');

    expect(keycloakService.login).toHaveBeenCalledWith('techcorp', 'alice', 'pw');
    expect(result).toBe(token);
  });

  it('does NOT accept the realmName as input — only the organizationId', async () => {
    organizationRepository.findById.mockResolvedValue({
      id: 'org-A',
      realmName: 'techcorp',
    } as Organization);
    keycloakService.login.mockResolvedValue({} as TokenResponse);

    await service.login('org-A', 'alice', 'pw');

    expect(organizationRepository.findById).toHaveBeenCalledWith('org-A');
    expect(organizationRepository.findById).toHaveBeenCalledTimes(1);
  });
});
