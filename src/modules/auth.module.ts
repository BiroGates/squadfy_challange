import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { RepositoriesModule } from './repositories.module';
import { KeycloakModule } from './keycloak.module';
import { AuthService } from '../services/auth/auth.service';
import { AuthController } from '../controllers/auth/auth.controller';
import { JwtStrategy } from '../controllers/auth/jwt.strategy';

@Module({
  imports: [PassportModule, KeycloakModule, RepositoriesModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
