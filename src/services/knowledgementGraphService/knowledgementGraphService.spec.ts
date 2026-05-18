import { KnowledgementGraphService } from './knowledgementGraphService';
import { KnowledgementRepository } from 'src/repositories/knowledgement/knowledgement.repository';
import { S3Service } from 'src/services/s3/s3.service';
import { PromptBuilder } from './knowledgementPrompts';
import { InferenceResponseType, Nodes } from 'src/types/knowledgementGraphl/enums';
import { Roles } from 'src/types/auth/enum';
import { Knowledgement } from 'infra/db/schema';
import { AuthenticatedUser } from 'src/types/auth/token';

function mockDoc(overrides: Partial<Knowledgement> = {}): Knowledgement {
  return {
    id: overrides.id ?? 'doc-1',
    title: overrides.title ?? 'Remote Work Policy',
    s3Key: overrides.s3Key ?? 'organizations/org-A/knowledgements/doc-1.txt',
    isRestricted: overrides.isRestricted ?? false,
    organizationId: overrides.organizationId ?? 'org-A',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Knowledgement;
}

function mockUser(roles: Roles[], organizationId = 'org-A'): AuthenticatedUser {
  return {
    keycloakId: 'kc-1',
    username: 'tester',
    organizationId,
    roles,
  };
}


function fakeModelReturning(structuredOutput: any) {
  const invoke = jest.fn().mockResolvedValue(structuredOutput);
  const withStructuredOutput = jest.fn().mockReturnValue({ invoke });
  return { withStructuredOutput, invoke } as any;
}

describe('KnowledgementGraphService', () => {
  let service: KnowledgementGraphService;
  let knowledgementRepo: jest.Mocked<KnowledgementRepository>;
  let s3Service: jest.Mocked<S3Service>;
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    knowledgementRepo = {
      findByOrganizationId: jest.fn(),
    } as any;
    s3Service = {
      downloadContent: jest.fn(),
      uploadContent: jest.fn(),
    } as any;
    promptBuilder = new PromptBuilder();
    service = new KnowledgementGraphService(knowledgementRepo, s3Service, promptBuilder);
  });

  
  describe('retrieveKnowledgeNode', () => {
    it('queries the repository scoped to the user organization', async () => {
      const docs = [mockDoc({ organizationId: 'org-A' })];
      knowledgementRepo.findByOrganizationId.mockResolvedValue(docs);

      const result = await service.retrieveKnowledgeNode({
        query: 'q',
        organizationId: 'org-A',
        user: mockUser([Roles.USER]),
        retrievedDocs: [],
        relevantDocs: [],
        answer: null,
        responseType: null,
      });

      expect(knowledgementRepo.findByOrganizationId).toHaveBeenCalledWith('org-A', false);
      expect(result.retrievedDocs).toBe(docs);
    });

    it('passes allowedToRestricted=true when caller has ADMIN role', async () => {
      knowledgementRepo.findByOrganizationId.mockResolvedValue([]);

      await service.retrieveKnowledgeNode({
        query: 'q',
        organizationId: 'org-A',
        user: mockUser([Roles.ADMIN]),
        retrievedDocs: [],
        relevantDocs: [],
        answer: null,
        responseType: null,
      });

      expect(knowledgementRepo.findByOrganizationId).toHaveBeenCalledWith('org-A', true);
    });

    it('passes allowedToRestricted=true when caller has ORGANIZATION role', async () => {
      knowledgementRepo.findByOrganizationId.mockResolvedValue([]);

      await service.retrieveKnowledgeNode({
        query: 'q',
        organizationId: 'org-A',
        user: mockUser([Roles.ORGANIZATION]),
        retrievedDocs: [],
        relevantDocs: [],
        answer: null,
        responseType: null,
      });

      expect(knowledgementRepo.findByOrganizationId).toHaveBeenCalledWith('org-A', true);
    });

    it('passes allowedToRestricted=false for plain USER role', async () => {
      knowledgementRepo.findByOrganizationId.mockResolvedValue([]);

      await service.retrieveKnowledgeNode({
        query: 'q',
        organizationId: 'org-A',
        user: mockUser([Roles.USER]),
        retrievedDocs: [],
        relevantDocs: [],
        answer: null,
        responseType: null,
      });

      expect(knowledgementRepo.findByOrganizationId).toHaveBeenCalledWith('org-A', false);
    });
  });

  describe('filterRelevantNode', () => {
    it('skips the LLM call when no documents were retrieved', async () => {
      const model = fakeModelReturning({ relevantIndices: [] });

      const result = await service.filterRelevantNode(
        {
          query: 'q',
          organizationId: 'org-A',
          user: mockUser([Roles.USER]),
          retrievedDocs: [],
          relevantDocs: [],
          answer: null,
          responseType: null,
        },
        model,
      );

      expect(model.withStructuredOutput).not.toHaveBeenCalled();
      expect(result.relevantDocs).toEqual([]);
    });

    it('keeps only the documents whose indices the LLM marked relevant', async () => {
      const docs = [
        mockDoc({ id: '0', title: 'Remote Work' }),
        mockDoc({ id: '1', title: 'Salary Bands' }),
        mockDoc({ id: '2', title: 'Onboarding' }),
      ];
      const model = fakeModelReturning({ relevantIndices: [0, 2] });

      const result = await service.filterRelevantNode(
        {
          query: 'q',
          organizationId: 'org-A',
          user: mockUser([Roles.USER]),
          retrievedDocs: docs,
          relevantDocs: [],
          answer: null,
          responseType: null,
        },
        model,
      );

      expect(result.relevantDocs).toEqual([docs[0], docs[2]]);
    });

    it('drops out-of-range indices returned by the LLM', async () => {
      const docs = [mockDoc({ id: '0' })];
      const model = fakeModelReturning({ relevantIndices: [0, 99, -1] });

      const result = await service.filterRelevantNode(
        {
          query: 'q',
          organizationId: 'org-A',
          user: mockUser([Roles.USER]),
          retrievedDocs: docs,
          relevantDocs: [],
          answer: null,
          responseType: null,
        },
        model,
      );

      expect(result.relevantDocs).toEqual([docs[0]]);
    });
  });


  describe('generateAnswerNode', () => {
    it('downloads S3 content for every relevant doc and returns ANSWER', async () => {
      const docs = [
        mockDoc({ id: '0', title: 'Remote Work', s3Key: 'k1' }),
        mockDoc({ id: '1', title: 'Onboarding', s3Key: 'k2' }),
      ];
      s3Service.downloadContent
        .mockResolvedValueOnce('Remote work content')
        .mockResolvedValueOnce('Onboarding content');

      const model = fakeModelReturning({
        responseType: InferenceResponseType.ANSWER,
        answer: 'You can work remotely 3 days/week.',
      });

      const result = await service.generateAnswerNode(
        {
          query: 'remote work?',
          organizationId: 'org-A',
          user: mockUser([Roles.USER]),
          retrievedDocs: docs,
          relevantDocs: docs,
          answer: null,
          responseType: null,
        },
        model,
      );

      expect(s3Service.downloadContent).toHaveBeenCalledWith('k1');
      expect(s3Service.downloadContent).toHaveBeenCalledWith('k2');
      expect(result.responseType).toBe(InferenceResponseType.ANSWER);
      expect(result.answer).toBe('You can work remotely 3 days/week.');
    });

    it('prefixes the answer with a disclaimer when the LLM returns INSUFFICIENT', async () => {
      const docs = [mockDoc({ s3Key: 'k1' })];
      s3Service.downloadContent.mockResolvedValue('partial content');

      const model = fakeModelReturning({
        responseType: InferenceResponseType.INSUFFICIENT,
        answer: 'no salary data in context',
      });

      const result = await service.generateAnswerNode(
        {
          query: 'what is the salary?',
          organizationId: 'org-A',
          user: mockUser([Roles.USER]),
          retrievedDocs: docs,
          relevantDocs: docs,
          answer: null,
          responseType: null,
        },
        model,
      );

      expect(result.responseType).toBe(InferenceResponseType.INSUFFICIENT);
      expect(result.answer).toContain('do not have sufficient knowledge');
      expect(result.answer).toContain('no salary data in context');
    });
  });


  describe('respondInsufficientNode', () => {
    it('returns INSUFFICIENT with a default answer', () => {
      const result = service.respondInsufficientNode({
        query: 'q',
        organizationId: 'org-A',
        user: mockUser([Roles.USER]),
        retrievedDocs: [],
        relevantDocs: [],
        answer: null,
        responseType: null,
      });

      expect(result.responseType).toBe(InferenceResponseType.INSUFFICIENT);
      expect(result.answer).toMatch(/do not have sufficient knowledge/i);
    });
  });


  describe('routeAfterFilter', () => {
    it('routes to RESPONSE_INSUFFICIENT when no relevant docs remain', () => {
      const node = service.routeAfterFilter({
        query: 'q',
        organizationId: 'org-A',
        user: mockUser([Roles.USER]),
        retrievedDocs: [],
        relevantDocs: [],
        answer: null,
        responseType: null,
      });
      expect(node).toBe(Nodes.RESPONSE_INSUFFICIENT);
    });

    it('routes to ANSWER when at least one relevant doc remains', () => {
      const node = service.routeAfterFilter({
        query: 'q',
        organizationId: 'org-A',
        user: mockUser([Roles.USER]),
        retrievedDocs: [],
        relevantDocs: [mockDoc()],
        answer: null,
        responseType: null,
      });
      expect(node).toBe(Nodes.ANSWER);
    });
  });
});
