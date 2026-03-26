import { IsDefined, IsNotEmpty, IsString } from 'class-validator';

export class SimulateIncomingDto {
  @IsString()
  @IsNotEmpty()
  // Feed giả lập dữ liệu đi vào server, ví dụ: temperature, humidity, fan_level
  feed: string;

  @IsDefined()
  // Giá trị giả lập từ thiết bị hoặc cloud
  value: unknown;
}
