import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFactoryDto {
  @IsNotEmpty()
  @IsString()
  factoryName: string;

  @IsOptional()
  @IsString()
  factoryCode?: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  organizationID: number;

  @IsOptional()
  @IsString()
  status?: string;
}
