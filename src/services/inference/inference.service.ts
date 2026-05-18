import { Injectable } from '@nestjs/common';

import { InferenceResultDto } from '../knowledgementGraphService/knowledgementGraphDto';
import { AuthenticatedUser } from 'src/types/auth/token';
import { KnowledgementGraphBuilderService } from '../knowledgeGraphBuilder/knowledgeGraphBuilderService';



@Injectable()
export class InferenceService {
  constructor(private readonly knowledgeGraphBuilderService: KnowledgementGraphBuilderService) {}

  async query(query: string, organizationId: string, user: AuthenticatedUser): Promise<InferenceResultDto> {
    return this.knowledgeGraphBuilderService.invoke(query, organizationId, user);
  }
}
