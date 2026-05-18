import { InferenceResponseType } from "src/types/knowledgementGraphl/enums";

export class InferenceResultDto {
  answer: string;
  responseType: InferenceResponseType;
}
