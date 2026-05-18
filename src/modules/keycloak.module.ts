import { Global, Module } from '@nestjs/common';
import { KeycloakService } from '../services/keycloak/keycloak.service';

@Global()
@Module({
  providers: [KeycloakService],
  exports: [KeycloakService],
})
export class KeycloakModule {}
