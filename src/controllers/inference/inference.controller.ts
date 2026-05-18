import { BadRequestException, Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { InferenceService } from '../../services/inference/inference.service';
import { InferenceQueryDto } from './dto/inference-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesDecoretor } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from 'src/types/auth/token';
import { Roles } from 'src/types/auth/enum';


@Controller('inference')
@RolesDecoretor(Roles.USER, Roles.ORGANIZATION, Roles.ADMIN)
export class InferenceController {
  constructor(private readonly inferenceService: InferenceService) {}

  @Post('query')
  query(@Body() dto: InferenceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const isAdmin = user.roles.includes(Roles.ADMIN)
    if (isAdmin && !dto.organizationId) {
      throw new BadRequestException("You must inform which organization you want to query for.");
    }
    
    if(!isAdmin && dto.organizationId) {
      throw new ForbiddenException("You are not allowed to query for other organizations.");
    }
    
    return this.inferenceService.query(dto.query, isAdmin ? dto.organizationId as string : user.organizationId, user);
  }
}
