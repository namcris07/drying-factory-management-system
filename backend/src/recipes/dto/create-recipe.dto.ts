import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsArray,
  ValidateNested,
} from 'class-validator';
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

export class CreateRecipeStageDto {
  @IsInt()
  stageOrder: number;

  @IsInt()
  durationMinutes: number;

  temperatureSetpoint: number;

  humiditySetpoint: number;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeStageDto)
  stages?: CreateRecipeStageDto[];
}
