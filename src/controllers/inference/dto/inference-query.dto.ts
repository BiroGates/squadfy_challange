import { IsString, MinLength } from 'class-validator';

export class InferenceQueryDto {
  @IsString()
  @MinLength(3)
  query: string;
}
