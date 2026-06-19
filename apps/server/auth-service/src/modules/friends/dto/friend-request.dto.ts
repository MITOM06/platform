import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FriendRequestDto {
  @ApiProperty({ description: 'User id of the friend-request recipient' })
  @IsString()
  @IsNotEmpty({ message: 'recipientId is required' })
  recipientId: string;
}
