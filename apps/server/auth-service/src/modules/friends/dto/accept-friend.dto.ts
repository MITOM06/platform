import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptFriendDto {
  @ApiProperty({ description: 'User id of the requester whose request is accepted' })
  @IsString()
  @IsNotEmpty({ message: 'requesterId is required' })
  requesterId: string;
}
