import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  IsArray,
} from 'class-validator';

export class CreateDeviceSensorChannelDto {
  @IsOptional()
  @IsString()
  sensorName?: string;

  @IsOptional()
  @IsString()
  sensorType?: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9._/-]+$/, {
    message: 'Feed key chỉ cho phép ký tự a-z, A-Z, 0-9, ., _, /, -',
  })
  feedKey!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class CreateDeviceActuatorChannelDto {
  @IsOptional()
  @IsString()
  actuatorName?: string;

  @IsOptional()
  @IsString()
  actuatorType?: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9._/-]+$/, {
    message: 'Feed key chỉ cho phép ký tự a-z, A-Z, 0-9, ., _, /, -',
  })
  feedKey!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  controlMode?: string;

  @IsOptional()
  @IsString()
  onValue?: string;

  @IsOptional()
  @IsString()
  offValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class CreateDeviceDto {
  @IsNotEmpty()
  @IsString()
  deviceName!: string;

  @IsOptional()
  @IsString()
  deviceStatus?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._/-]+$/, {
    message: 'Feed key chỉ cho phép ký tự a-z, A-Z, 0-9, ., _, /, -',
  })
  mqttTopicSensor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._/-]+$/, {
    message: 'Feed key chỉ cho phép ký tự a-z, A-Z, 0-9, ., _, /, -',
  })
  mqttTopicCmd?: string;

  @IsOptional()
  @IsString()
  // Không giới hạn cứng loại thiết bị để hỗ trợ mở rộng: máy bơm, máy gia nhiệt, v.v.
  deviceType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zoneID?: number;

  @IsOptional()
  @IsObject()
  metaData?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDeviceSensorChannelDto)
  sensorChannels?: CreateDeviceSensorChannelDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDeviceActuatorChannelDto)
  actuatorChannels?: CreateDeviceActuatorChannelDto[];

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
