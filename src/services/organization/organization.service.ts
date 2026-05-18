import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { KnowledgementRepository } from '../../repositories/knowledgement/knowledgement.repository';
import { UserRepository } from '../../repositories/user/user.repository';
import { S3Service } from '../s3/s3.service';
import { Knowledgement, User } from '../../../infra/db/schema';
import { CreateKnowledgementDto } from '../../controllers/organization/dto/create-knowledgement.dto';
import { AuthenticatedUser } from 'src/types/auth/token';
import { Roles } from 'src/types/auth/enum';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly knowledgementRepository: KnowledgementRepository,
    private readonly userRepository: UserRepository,
    private readonly s3Service: S3Service,
  ) {}

  async createKnowledgement(
    organizationId: string,
    dto: CreateKnowledgementDto,
  ): Promise<Knowledgement> {
    const id = randomUUID();
    const s3Key = `organizations/${organizationId}/knowledgements/${id}.txt`;
    await this.s3Service.uploadContent(s3Key, dto.content);
    return this.knowledgementRepository.create({
      id,
      title: dto.title,
      s3Key,
      isRestricted: dto.isRestricted,
      organizationId,
    });
  }

  async listKnowledgements(organizationId: string, user: AuthenticatedUser): Promise<Knowledgement[]> {
    const allowedToRestricted = user.roles.some(r => r === Roles.ADMIN || r === Roles.ORGANIZATION);
    return this.knowledgementRepository.findByOrganizationId(organizationId, allowedToRestricted);
  }

  async deleteKnowledgement(organizationId: string, id: string): Promise<void> {
    const doc = await this.knowledgementRepository.findById(id);
    if (!doc) throw new NotFoundException('Knowledgement not found');
    if (doc.organizationId !== organizationId) throw new ForbiddenException();
    await this.knowledgementRepository.delete(id);
  }

  async listUsers(organizationId: string): Promise<User[]> {
    return this.userRepository.findByOrganizationId(organizationId);
  }

  async deleteUser(organizationId: string, userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.organizationId !== organizationId) throw new ForbiddenException();
    await this.userRepository.delete(userId);
  }
}
