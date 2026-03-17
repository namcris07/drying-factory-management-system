import { IsNotEmpty, IsOptional, IsString, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRecipeStepDto {
  @IsOptional()
  @IsInt()
  stepNo?: number;

  @IsOptional()
  temperatureGoal?: number;

  @IsOptional()
  humidityGoal?: number;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  fanStatus?: string;
}

export class CreateRecipeDto {
  @IsNotEmpty()
  @IsString()
  recipeName: string;

  @IsOptional()
  @IsString()
  recipeFruits?: string;

  @IsOptional()
  @IsInt()
  timeDurationEst?: number;

  @IsOptional()
  userID?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeStepDto)
  steps?: CreateRecipeStepDto[];
}
