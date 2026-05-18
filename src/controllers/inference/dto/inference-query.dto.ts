import { IsString, MinLength, IsOptional } from 'class-validator';

export class InferenceQueryDto {
  @IsString()
  @MinLength(3)
  query: string;

  @IsString()
  @IsOptional()
  organizationId?: string;
}
