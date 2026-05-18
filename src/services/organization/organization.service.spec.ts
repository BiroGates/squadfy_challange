import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { KnowledgementRepository } from '../../repositories/knowledgement/knowledgement.repository';
import { UserRepository } from '../../repositories/user/user.repository';
import { S3Service } from '../s3/s3.service';
import { Roles } from 'src/types/auth/enum';
import { AuthenticatedUser } from 'src/types/auth/token';
import { Knowledgement, User } from '../../../infra/db/schema';

function mockUser(roles: Roles[], organizationId = 'org-A'): AuthenticatedUser {
  return { keycloakId: 'kc-1', username: 'tester', organizationId, roles };
}

describe('OrganizationService', () => {
  let service: OrganizationService;
  let knowledgementRepo: jest.Mocked<KnowledgementRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let s3Service: jest.Mocked<S3Service>;

  beforeEach(() => {
    knowledgementRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByOrganizationId: jest.fn(),
      delete: jest.fn(),
    } as any;
    userRepo = {
      findById: jest.fn(),
      findByOrganizationId: jest.fn(),
      delete: jest.fn(),
    } as any;
    s3Service = {
      uploadContent: jest.fn(),
      downloadContent: jest.fn(),
    } as any;
    service = new OrganizationService(knowledgementRepo, userRepo, s3Service);
  });


  describe('createKnowledgement', () => {
    it('uploads content to S3 under the org namespace and persists metadata', async () => {
      knowledgementRepo.create.mockResolvedValue({ id: 'doc-1' } as Knowledgement);

      await service.createKnowledgement('org-A', {
        title: 'Vacation Policy',
        content: '20 days/year',
        isRestricted: false,
      });

      expect(s3Service.uploadContent).toHaveBeenCalledTimes(1);
      const [s3Key, content] = s3Service.uploadContent.mock.calls[0];
      expect(s3Key).toMatch(/^organizations\/org-A\/knowledgements\/.+\.txt$/);
      expect(content).toBe('20 days/year');

      expect(knowledgementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Vacation Policy',
          isRestricted: false,
          organizationId: 'org-A',
          s3Key,
        }),
      );
    });
  });


  describe('listKnowledgements', () => {
    it('does NOT include restricted docs for a plain USER', async () => {
      knowledgementRepo.findByOrganizationId.mockResolvedValue([]);

      await service.listKnowledgements('org-A', mockUser([Roles.USER]));

      expect(knowledgementRepo.findByOrganizationId).toHaveBeenCalledWith('org-A', false);
    });

    it('includes restricted docs for ORGANIZATION role', async () => {
      knowledgementRepo.findByOrganizationId.mockResolvedValue([]);

      await service.listKnowledgements('org-A', mockUser([Roles.ORGANIZATION]));

      expect(knowledgementRepo.findByOrganizationId).toHaveBeenCalledWith('org-A', true);
    });

    it('includes restricted docs for ADMIN role', async () => {
      knowledgementRepo.findByOrganizationId.mockResolvedValue([]);

      await service.listKnowledgements('org-A', mockUser([Roles.ADMIN]));

      expect(knowledgementRepo.findByOrganizationId).toHaveBeenCalledWith('org-A', true);
    });
  });

  
  describe('deleteKnowledgement', () => {
    it('throws NotFoundException when the document does not exist', async () => {
      knowledgementRepo.findById.mockResolvedValue(null);

      await expect(service.deleteKnowledgement('org-A', 'doc-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(knowledgementRepo.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the doc belongs to another organization', async () => {
      knowledgementRepo.findById.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-B',
      } as Knowledgement);

      await expect(service.deleteKnowledgement('org-A', 'doc-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(knowledgementRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes the document when ownership matches', async () => {
      knowledgementRepo.findById.mockResolvedValue({
        id: 'doc-1',
        organizationId: 'org-A',
      } as Knowledgement);

      await service.deleteKnowledgement('org-A', 'doc-1');

      expect(knowledgementRepo.delete).toHaveBeenCalledWith('doc-1');
    });
  });


  describe('deleteUser', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(service.deleteUser('org-A', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(userRepo.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the user belongs to another organization', async () => {
      userRepo.findById.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-B',
      } as User);

      await expect(service.deleteUser('org-A', 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(userRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes the user when ownership matches', async () => {
      userRepo.findById.mockResolvedValue({
        id: 'user-1',
        organizationId: 'org-A',
      } as User);

      await service.deleteUser('org-A', 'user-1');

      expect(userRepo.delete).toHaveBeenCalledWith('user-1');
    });
  });
});
