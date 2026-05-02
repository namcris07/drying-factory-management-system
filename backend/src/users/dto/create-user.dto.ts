import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ArrayUnique,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['Admin', 'Manager', 'Operator'])
  role: string;

  @IsOptional()
  phoneNumber?: string;

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
