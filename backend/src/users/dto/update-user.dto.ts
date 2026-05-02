import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  IsIn,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Admin', 'Manager', 'Operator'])
  role?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  chamberIDs?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  organizationID?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  factoryID?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  siteID?: number;
}
