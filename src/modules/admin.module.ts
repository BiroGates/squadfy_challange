import { Module } from '@nestjs/common';
import { RepositoriesModule } from './repositories.module';
import { KeycloakModule } from 'src/modules/keycloak.module';
import { AdminController } from 'src/controllers/admin/admin.controller';
import { AdminService } from 'src/services/admin/admin.service';


@Module({
  imports: [RepositoriesModule, KeycloakModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
