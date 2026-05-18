import { Body, Controller, Post } from '@nestjs/common';
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
    return this.inferenceService.query(dto.query, user.organizationId, user);
  }
}
