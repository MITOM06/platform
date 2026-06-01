import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptFriendDto {
  @IsString()
  @IsNotEmpty({ message: 'requesterId is required' })
  requesterId: string;
}
