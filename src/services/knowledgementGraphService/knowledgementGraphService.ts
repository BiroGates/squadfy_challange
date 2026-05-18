import { S3Service } from "src/services/s3/s3.service";
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { KnowledgementRepository } from "src/repositories/knowledgement/knowledgement.repository";
import { Injectable, Logger } from "@nestjs/common";
import { Knowledgement } from "infra/db/schema";
import { PromptBuilder } from "./knowledgementPrompts";
import { FilterRelevantOutput, FilterRelevantSchema, GenerateAnswerOutput, GenerateAnswerSchema, KnowledgementGraphStateType } from "src/types/knowledgementGraphl/zod";
import { InferenceResponseType, Nodes } from "src/types/knowledgementGraphl/enums";
import { Roles } from "src/types/auth/enum";


export type IKnowledgementGraphService = {
    filterRelevantNode: (state: KnowledgementGraphStateType, model: BaseChatModel) => Promise<Partial<KnowledgementGraphStateType>>;
    generateAnswerNode: (state: KnowledgementGraphStateType, model: BaseChatModel, s3Service: S3Service) =>  Promise<Partial<KnowledgementGraphStateType>>;
    respondInsufficientNode: (_state: KnowledgementGraphStateType) => Partial<KnowledgementGraphStateType>;
    retrieveKnowledgeNode: (state: KnowledgementGraphStateType) => Promise<Partial<KnowledgementGraphStateType>>;
    routeAfterFilter: (state: KnowledgementGraphStateType) => Nodes;
}


@Injectable()
export class KnowledgementGraphService implements IKnowledgementGraphService {
    private readonly logger = new Logger(KnowledgementGraphService.name);

    constructor(
        private readonly knowledgementRepo: KnowledgementRepository,
        private readonly s3Service: S3Service,
        private readonly promptBuilder: PromptBuilder,
    ) {}

    
    filterRelevantNode = async (state: KnowledgementGraphStateType, model: BaseChatModel) => {
        if (state.retrievedDocs.length === 0) {
            this.logger.warn(`No documents retrieved for organization ${state.organizationId}. Skipping relevance filtering.`);
            return { relevantDocs: [] };
        }

        this.logger.log(`Found ${state.retrievedDocs.length} documents for organization ${state.organizationId}. Filtering for relevance...`);
        const docList = state.retrievedDocs.map((doc, i) => `${i}. ${doc.title}`).join('\n');
        const message = this.promptBuilder.buildFilterRelevant(state.query, docList);

        try {
            const structuredModel = model.withStructuredOutput(FilterRelevantSchema);
            
            this.logger.log('Calling model for relevance filtering...');
            const result: FilterRelevantOutput = await structuredModel.invoke(message);

            const relevantDocs: Knowledgement[] = result.relevantIndices
                .filter((i) => i >= 0 && i < state.retrievedDocs.length)
                .map((i) => state.retrievedDocs[i]);

            return { relevantDocs };
        } catch(e: any) {
            this.logger.error(`Error during relevance filtering: ${e.message}`);
            throw new Error(`Failed to filter relevant documents: ${e.message}`);
        }
    }
    generateAnswerNode = async (state: KnowledgementGraphStateType, model: BaseChatModel) => {
        this.logger.log('Retrieving content for relevant documents...');
        const contextParts = await Promise.all(
            state.relevantDocs.map(async (doc) => {
                const content = await this.s3Service.downloadContent(doc.s3Key);
                return `[${doc.title}]\n${content}`;
            }),
        );
        
        const context = contextParts.join('\n\n---\n\n');
        const message = this.promptBuilder.buildAnswer(state.query, context);
        
        try {
            const structuredModel = model.withStructuredOutput(GenerateAnswerSchema);
            const result: GenerateAnswerOutput = await structuredModel.invoke(message);

            
            if (result.responseType === InferenceResponseType.INSUFFICIENT) {
                return {
                    answer: `I do not have sufficient knowledge to answer this question accurately. Reason: ${result.answer}`,
                    responseType: InferenceResponseType.INSUFFICIENT,
                };
            }
            
            return {
                answer: result.answer,
                responseType: InferenceResponseType.ANSWER,
            };
        } catch (e: any){
            console.log(JSON.stringify(e));
            throw new Error(e.message);
        }
    }
    respondInsufficientNode = (_state: KnowledgementGraphStateType) => {
        return {
            answer: 'I do not have sufficient knowledge to answer this question.',
            responseType: InferenceResponseType.INSUFFICIENT,
        };
    }

    retrieveKnowledgeNode = async (state: KnowledgementGraphStateType) => {
        const { user } = state;
        const allowedToRestricted = user.roles.some(r => r === Roles.ADMIN || r === Roles.ORGANIZATION);

        const docs = await this.knowledgementRepo.findByOrganizationId(state.organizationId, allowedToRestricted);
        return { retrievedDocs: docs } as KnowledgementGraphStateType
    }

    routeAfterFilter = (state: KnowledgementGraphStateType) => {
        if (state.relevantDocs.length === 0) {
            return Nodes.RESPONSE_INSUFFICIENT
        }
        return Nodes.ANSWER;
    }
}