import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class ChamberSensorDto {
  @IsOptional()
  @IsString()
  sensorName?: string;

  @IsString()
  @IsIn([
    'TemperatureSensor',
    'HumiditySensor',
    'LightSensor',
    'Lcd',
    'Fan',
    'Custom',
  ])
  sensorType: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9._/-]+$/, {
    message: 'Feed key chỉ cho phép ký tự a-z, A-Z, 0-9, ., _, /, -',
  })
  feedKey: string;

  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive', 'Maintenance'])
  status?: string;
}

export class CreateChamberDto {
  @IsNotEmpty()
  @IsString()
  chamberName: string;

  @IsOptional()
  @IsString()
  chamberDescription?: string;

  @Type(() => Number)
  @IsInt()
  zoneID: number;

  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Inactive', 'Maintenance'])
  chamberStatus?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChamberSensorDto)
  sensors?: ChamberSensorDto[];
}
