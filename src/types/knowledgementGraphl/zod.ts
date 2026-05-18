import { z } from "zod";
import { InferenceResponseType } from "./enums";
import { KnowledgementGraphState } from "./state";



export const FilterRelevantSchema = z.object({
  relevantIndices: z
    .array(z.number().int().nonnegative())
    .describe(
      'Zero-based indices of the documents that are relevant to answering the question. Empty array if none are relevant.',
    ),
});

export type FilterRelevantOutput = z.infer<typeof FilterRelevantSchema>;

export const GenerateAnswerSchema = z.object({
  responseType: z
    .enum([InferenceResponseType.ANSWER, InferenceResponseType.INSUFFICIENT])
    .describe(
      `${InferenceResponseType.ANSWER} when the provided context contains enough information to answer the question; ${InferenceResponseType.INSUFFICIENT} otherwise.`,
    ),
  answer: z
    .string()
    .describe(
      `When responseType is ${InferenceResponseType.ANSWER}: the answer to the question, strictly derived from the context. 
        When responseType is ${InferenceResponseType.INSUFFICIENT}: a brief explanation of why the context is not enough.`,
    ),
});

export type GenerateAnswerOutput = z.infer<typeof GenerateAnswerSchema>;

export type KnowledgementGraphStateType = typeof KnowledgementGraphState.State;
