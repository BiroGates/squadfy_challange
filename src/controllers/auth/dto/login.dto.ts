import { IsString, IsUUID } from 'class-validator';

export class LoginDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  username: string;

  @IsString()
  password: string;
}
