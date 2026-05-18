import { Annotation } from "@langchain/langgraph";
import { InferenceResponseType } from "./enums";
import { Knowledgement } from "infra/db/schema";
import { AuthenticatedUser } from "../auth/token";


export const KnowledgementGraphState = Annotation.Root({
  query: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),
  user: Annotation<AuthenticatedUser>({
    reducer: (_current, update) => update,
  }),
  organizationId: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),
  
  retrievedDocs: Annotation<Knowledgement[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  
  relevantDocs: Annotation<Knowledgement[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  
  answer: Annotation<string | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  responseType: Annotation<InferenceResponseType | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});