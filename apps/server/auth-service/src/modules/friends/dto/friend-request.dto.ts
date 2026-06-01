import { IsNotEmpty, IsString } from 'class-validator';

export class FriendRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'recipientId is required' })
  recipientId: string;
}
