import { Injectable, NotFoundException } from '@nestjs/common';
import { KeycloakService } from '../keycloak/keycloak.service';
import { OrganizationRepository } from '../../repositories/organization/organization.repository';
import { UserRepository } from '../../repositories/user/user.repository';
import { Organization } from '../../../infra/db/schema';
import { CreateOrganizationDto } from '../../controllers/admin/dto/create-organization.dto';
import { CreateUserDto } from '../../controllers/admin/dto/create-user.dto';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 36);
}

@Injectable()
export class AdminService {
  constructor(
    private readonly keycloakService: KeycloakService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async createOrganization(dto: CreateOrganizationDto): Promise<Organization> {
    const realmName = slugify(dto.name);
    await this.keycloakService.createRealm(realmName);
    return this.organizationRepository.create({ name: dto.name, realmName });
  }

  async createUser(dto: CreateUserDto) {
    const org = await this.organizationRepository.findById(dto.organizationId);
    if (!org) throw new NotFoundException('Organization not found');

    const keycloakId = await this.keycloakService.createUser(
      org.realmName,
      dto.username,
      dto.password,
      dto.role as unknown as string,
    );

    return this.userRepository.create({
      keycloakId,
      username: dto.username,
      organizationId: dto.organizationId,
      role: dto.role
    });
  }

  async listOrganizations(): Promise<Organization[]> {
    return this.organizationRepository.findAll();
  }
}
