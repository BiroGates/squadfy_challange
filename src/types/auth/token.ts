import { Roles } from "./enum";

export interface AuthenticatedUser {
  keycloakId: string;
  username: string;
  organizationId: string;
  roles: Roles[];
}

export interface KeycloakJwtPayload {
  sub: string;
  iss: string;
  preferred_username: string;
  realm_access?: { roles: string[] };
  exp: number;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}
