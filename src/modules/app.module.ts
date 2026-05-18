import { ConfigModule } from "@nestjs/config";
import { KeycloakModule } from "src/modules/keycloak.module";
import { DatabaseModule } from "infra/db/database.module";
import { RepositoriesModule } from "./repositories.module";
import { AuthModule } from "src/modules/auth.module";
import { AdminModule } from "./admin.module";
import { OrganizationModule } from "./organization.module";
import { InferenceModule } from "./inference.module";
import { APP_GUARD } from "@nestjs/core";
import { RolesGuard } from "src/controllers/auth/guards/roles.guard";
import { JwtAuthGuard } from "src/controllers/auth/guards/jwt-auth.guard";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    KeycloakModule,
    RepositoriesModule,
    AuthModule,
    AdminModule,
    OrganizationModule,
    InferenceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
