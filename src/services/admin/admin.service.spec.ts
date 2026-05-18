import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { KeycloakService } from '../keycloak/keycloak.service';
import { OrganizationRepository } from '../../repositories/organization/organization.repository';
import { UserRepository } from '../../repositories/user/user.repository';
import { Roles } from 'src/types/auth/enum';
import { Organization, User } from '../../../infra/db/schema';

describe('AdminService', () => {
  let service: AdminService;
  let keycloakService: jest.Mocked<KeycloakService>;
  let organizationRepository: jest.Mocked<OrganizationRepository>;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    keycloakService = {
      createRealm: jest.fn(),
      createUser: jest.fn(),
    } as any;
    organizationRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
    } as any;
    userRepository = {
      create: jest.fn(),
    } as any;
    service = new AdminService(keycloakService, organizationRepository, userRepository);
  });


  describe('createOrganization', () => {
    it('creates the Keycloak realm BEFORE persisting the organization row', async () => {
      const callOrder: string[] = [];
      keycloakService.createRealm.mockImplementation(async () => {
        callOrder.push('keycloak.createRealm');
      });
      organizationRepository.create.mockImplementation(async (data) => {
        callOrder.push('db.create');
        return { id: 'org-1', ...data } as Organization;
      });

      await service.createOrganization({ name: 'TechCorp' });

      expect(callOrder).toEqual(['keycloak.createRealm', 'db.create']);
    });

    it('slugifies the organization name to derive the realm name', async () => {
      organizationRepository.create.mockResolvedValue({ id: 'org-1' } as Organization);

      await service.createOrganization({ name: 'Acme Corp & Co. 2024!' });

      expect(keycloakService.createRealm).toHaveBeenCalledWith('acme-corp--co-2024');
      expect(organizationRepository.create).toHaveBeenCalledWith({
        name: 'Acme Corp & Co. 2024!',
        realmName: 'acme-corp--co-2024',
      });
    });
  });


  describe('createUser', () => {
    it('throws NotFoundException when the target organization does not exist', async () => {
      organizationRepository.findById.mockResolvedValue(null);

      await expect(
        service.createUser({
          organizationId: 'org-A',
          username: 'alice',
          password: 'Secret1!',
          role: Roles.USER,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(keycloakService.createUser).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('persists the keycloakId returned by Keycloak into the DB row', async () => {
      organizationRepository.findById.mockResolvedValue({
        id: 'org-A',
        realmName: 'techcorp',
      } as Organization);
      keycloakService.createUser.mockResolvedValue('kc-user-uuid-123');
      userRepository.create.mockResolvedValue({ id: 'db-user-1' } as User);

      await service.createUser({
        organizationId: 'org-A',
        username: 'alice',
        password: 'Secret1!',
        role: Roles.USER,
      });

      expect(keycloakService.createUser).toHaveBeenCalledWith(
        'techcorp',
        'alice',
        'Secret1!',
        Roles.USER,
      );
      expect(userRepository.create).toHaveBeenCalledWith({
        keycloakId: 'kc-user-uuid-123',
        username: 'alice',
        organizationId: 'org-A',
        role: Roles.USER,
      });
    });

    it('uses the realm of the organization (not the org id)', async () => {
      organizationRepository.findById.mockResolvedValue({
        id: 'org-A',
        realmName: 'financegroup',
      } as Organization);
      keycloakService.createUser.mockResolvedValue('kc-user-1');
      userRepository.create.mockResolvedValue({} as User);

      await service.createUser({
        organizationId: 'org-A',
        username: 'bob',
        password: 'Secret1!',
        role: Roles.ORGANIZATION,
      });

      
      const [realm] = keycloakService.createUser.mock.calls[0];
      expect(realm).toBe('financegroup');
    });
  });

  describe('listOrganizations', () => {
    it('returns whatever the repository returns', async () => {
      const orgs = [{ id: 'org-1' }, { id: 'org-2' }] as Organization[];
      organizationRepository.findAll.mockResolvedValue(orgs);

      await expect(service.listOrganizations()).resolves.toBe(orgs);
    });
  });
});
