import { IsArray, IsString } from 'class-validator';

export class SubscribeFeedsDto {
  @IsArray()
  @IsString({ each: true })
  // Danh sách feed muốn lắng nghe lại runtime
  feeds: string[];
}
