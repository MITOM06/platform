import { IsArray, IsIn, IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMemberDto {
  @ApiPropertyOptional({ description: 'Role id to assign to the member' })
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Department ids the member belongs to',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  departmentIds?: string[];
}

export class UpdateMemberStatusDto {
  @ApiProperty({ enum: ['active', 'blocked'] })
  @IsIn(['active', 'blocked'])
  status: 'active' | 'blocked';
}

/** GET /admin/members item (also returned by PATCH /admin/members/:id/status). */
export class MemberDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiPropertyOptional()
  roleId?: string;

  @ApiProperty({ type: [String] })
  departmentIds: string[];

  @ApiProperty({ enum: ['active', 'blocked', 'pending'] })
  status: 'active' | 'blocked' | 'pending';
}
