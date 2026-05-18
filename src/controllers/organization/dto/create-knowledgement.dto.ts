import { IsBoolean, IsString, MinLength } from 'class-validator';

export class CreateKnowledgementDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(10)
  content: string;

  @IsBoolean()
  isRestricted: boolean;
}
