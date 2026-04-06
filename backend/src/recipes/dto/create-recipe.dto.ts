import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRecipeStepDto {
  @IsOptional()
  @IsInt()
  stepNo?: number;

  @IsOptional()
  @IsNumber({}, { message: 'temperatureGoal must be a number' })
  temperatureGoal?: number;

  @IsOptional()
  @IsNumber({}, { message: 'humidityGoal must be a number' })
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
  stageOrder!: number;

  @IsInt()
  durationMinutes!: number;

  @IsNumber({}, { message: 'temperatureSetpoint must be a number' })
  temperatureSetpoint!: number;

  @IsNumber({}, { message: 'humiditySetpoint must be a number' })
  humiditySetpoint!: number;
}

export class CreateRecipeDto {
  @IsNotEmpty()
  @IsString()
  recipeName!: string;

  @IsOptional()
  @IsString()
  recipeFruits?: string;

  @IsOptional()
  @IsInt()
  timeDurationEst?: number;

  @IsOptional()
  @IsInt()
  userID?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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
