import { Module } from '@nestjs/common';
import { OrganizationRepository } from '../repositories/organization/organization.repository';
import { UserRepository } from '../repositories/user/user.repository';
import { KnowledgementRepository } from '../repositories/knowledgement/knowledgement.repository';

@Module({
  providers: [OrganizationRepository, UserRepository, KnowledgementRepository],
  exports: [OrganizationRepository, UserRepository, KnowledgementRepository],
})
export class RepositoriesModule {}
