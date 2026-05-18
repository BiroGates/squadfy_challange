import { IsIn, IsString, IsUUID, MinLength } from 'class-validator';
import { Roles } from 'src/types/auth/enum';


export class CreateUserDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(['USER', 'ADMIN', 'ORGANIZATION'])
  role: Roles;
}
