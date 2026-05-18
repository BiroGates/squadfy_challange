import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { AdminService } from '../../services/admin/admin.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { RolesDecoretor } from '../auth/decorators/roles.decorator';
import { Roles } from 'src/types/auth/enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/types/auth/token';

@Controller('admin')
@RolesDecoretor(Roles.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private assertSameOrg(user: AuthenticatedUser, orgId: string) {
    if (user.organizationId !== orgId) throw new ForbiddenException();
  }
  
  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.adminService.createOrganization(dto);
  }

  @RolesDecoretor(Roles.ADMIN, Roles.ORGANIZATION)
  @Post('users')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes(Roles.ADMIN)) {
      this.assertSameOrg(user, dto.organizationId);
      if (dto.role === Roles.ADMIN) {
        throw new ForbiddenException('Only admins can create other admins');
      }
    }
    return this.adminService.createUser(dto);
  }
  @Get('organizations')
  listOrganizations() {
    return this.adminService.listOrganizations();
  }
}
