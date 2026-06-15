import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSiteDto {
  @IsNotEmpty()
  @IsString()
  siteName: string;

  @IsOptional()
  @IsString()
  siteCode?: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  factoryID: number;

  @IsOptional()
  @IsString()
  status?: string;
}
