import { IsArray, IsMongoId, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
