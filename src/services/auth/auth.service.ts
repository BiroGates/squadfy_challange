import { Injectable, NotFoundException } from '@nestjs/common';
import { KeycloakService } from '../keycloak/keycloak.service';
import { OrganizationRepository } from '../../repositories/organization/organization.repository';
import { TokenResponse } from 'src/types/auth/token';

@Injectable()
export class AuthService {
  constructor(
    private readonly keycloakService: KeycloakService,
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async login(organizationId: string, username: string, password: string): Promise<TokenResponse> {
    const org = await this.organizationRepository.findById(organizationId);
    if (!org) throw new NotFoundException('Organization not found');
    return this.keycloakService.login(org.realmName, username, password);
  }
}
