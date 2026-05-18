import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { OrganizationService } from '../../services/organization/organization.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesDecoretor } from '../auth/decorators/roles.decorator';
import { Roles } from 'src/types/auth/enum';
import { CreateKnowledgementDto } from './dto/create-knowledgement.dto';
import { AuthenticatedUser } from 'src/types/auth/token';

@Controller('organizations/:orgId')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  private assertSameOrg(user: AuthenticatedUser, orgId: string) {
    if (user.organizationId !== orgId) throw new ForbiddenException();
  }

  @Post('knowledge')
  @RolesDecoretor(Roles.ORGANIZATION)
  createKnowledge(
    @Param('orgId') orgId: string,
    @Body() dto: CreateKnowledgementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertSameOrg(user, orgId);
    return this.organizationService.createKnowledgement(orgId, dto);
  }

  @Get('knowledge')
  @RolesDecoretor(Roles.ORGANIZATION, Roles.ADMIN)
  listKnowledge(@Param('orgId') orgId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes(Roles.ADMIN)) {
      this.assertSameOrg(user, orgId);
    }
    return this.organizationService.listKnowledgements(orgId, user);
  }

  @Delete('knowledge/:id')
  @RolesDecoretor(Roles.ORGANIZATION)
  deleteKnowledge(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertSameOrg(user, orgId);
    return this.organizationService.deleteKnowledgement(orgId, id);
  }

  @Get('users')
  @RolesDecoretor(Roles.ORGANIZATION, Roles.ADMIN)
  listUsers(@Param('orgId') orgId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.roles.includes(Roles.ADMIN)) {
      this.assertSameOrg(user, orgId);
    }
    return this.organizationService.listUsers(orgId);
  }

  @Delete('users/:userId')
  @RolesDecoretor(Roles.ADMIN)
  deleteUser(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertSameOrg(user, orgId);
    return this.organizationService.deleteUser(orgId, userId);
  }
}
