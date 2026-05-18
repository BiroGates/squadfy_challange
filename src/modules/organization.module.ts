import { Module } from '@nestjs/common';
import { RepositoriesModule } from './repositories.module';
import { OrganizationController } from 'src/controllers/organization/organization.controller';
import { OrganizationService } from 'src/services/organization/organization.service';
import { S3Service } from 'src/services/s3/s3.service';

@Module({
  imports: [RepositoriesModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, S3Service],
})
export class OrganizationModule {}
