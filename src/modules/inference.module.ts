import { Module } from '@nestjs/common';
import { RepositoriesModule } from './repositories.module';
import { InferenceController } from 'src/controllers/inference/inference.controller';
import { InferenceService } from 'src/services/inference/inference.service';
import { S3Service } from 'src/services/s3/s3.service';
import { KnowledgementGraphBuilderService } from 'src/services/knowledgeGraphBuilder/knowledgeGraphBuilderService';
import { PromptBuilder } from 'src/services/knowledgementGraphService/knowledgementPrompts';
import { KnowledgementGraphService } from 'src/services/knowledgementGraphService/knowledgementGraphService';



@Module({
  imports: [RepositoriesModule],
  controllers: [InferenceController],
  providers: [InferenceService, KnowledgementGraphService, KnowledgementGraphBuilderService, S3Service, PromptBuilder],
})
export class InferenceModule {}
