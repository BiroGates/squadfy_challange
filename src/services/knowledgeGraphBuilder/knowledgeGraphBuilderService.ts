import { Injectable, ServiceUnavailableException, Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { StateGraph, START, END } from '@langchain/langgraph';
import type { CompiledStateGraph } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { InferenceResultDto } from '../knowledgementGraphService/knowledgementGraphDto';
import { KnowledgementGraphStateType } from 'src/types/knowledgementGraphl/zod';
import { KnowledgementGraphState } from 'src/types/knowledgementGraphl/state';
import { InferenceResponseType, Nodes } from 'src/types/knowledgementGraphl/enums';
import { AuthenticatedUser } from 'src/types/auth/token';
import { KnowledgementGraphService } from '../knowledgementGraphService/knowledgementGraphService';


@Injectable()
export class KnowledgementGraphBuilderService {
  private readonly logger = new Logger(KnowledgementGraphBuilderService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly graph: CompiledStateGraph<any, any, any>;
  private readonly model: BaseChatModel;

  constructor(
    private readonly knowledgementGraphService: KnowledgementGraphService,
    private readonly config: ConfigService,
  ) {
    
    this.model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-flash',
      apiKey: config.get<string>('GOOGLE_API_KEY'),
      maxRetries: 0,
      temperature: 0.7,
    }); 
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    return (
      new StateGraph(KnowledgementGraphState)
        .addNode(Nodes.RETRIEVE_KNOWLEDGE, (s: KnowledgementGraphStateType) => this.knowledgementGraphService.retrieveKnowledgeNode(s))
        .addNode(Nodes.FILTER_RELEVEANT, (s: KnowledgementGraphStateType) => this.knowledgementGraphService.filterRelevantNode(s, this.model))
        .addNode(Nodes.RESPONSE_INSUFFICIENT, (s: KnowledgementGraphStateType) => this.knowledgementGraphService.respondInsufficientNode(s))
        .addNode(Nodes.ANSWER, (s: KnowledgementGraphStateType) => this.knowledgementGraphService.generateAnswerNode(s, this.model))
        
        .addEdge(START, Nodes.RETRIEVE_KNOWLEDGE)
        .addEdge(Nodes.RETRIEVE_KNOWLEDGE, Nodes.FILTER_RELEVEANT)
        .addConditionalEdges(Nodes.FILTER_RELEVEANT, this.knowledgementGraphService.routeAfterFilter)
        .addEdge(Nodes.RESPONSE_INSUFFICIENT, END)
        .addEdge(Nodes.ANSWER, END)
        .compile()
    );
  }

  async invoke(query: string, organizationId: string, user: AuthenticatedUser): Promise<InferenceResultDto> {
    try {
      const result = await this.graph.invoke(
        { query, organizationId, user },
      );
      return {
        answer: result.answer as string,
        responseType: result.responseType as InferenceResponseType
      };
    } catch (err: any) {
      
      if (err?.status === 429) {
        this.logger.warn('Gemini rate limit hit (429). Free tier quota exhausted.');
        throw new ServiceUnavailableException(
          'AI model rate limit reached. Please wait a moment and try again.',
        );
      }
      throw err;
    }
  }
}
