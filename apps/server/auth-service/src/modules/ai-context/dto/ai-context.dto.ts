import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Capability } from '@platform/database';

export class UpdateSoftContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  style?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  preferences?: string;
}

export class UpdateHardContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  jobTitle?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projects?: string[];
}

export class UpsertEntryDto {
  @IsIn(['company', 'department'])
  scope: 'company' | 'department';

  @IsOptional()
  @IsString()
  scopeId?: string | null;

  @IsString()
  @MaxLength(120)
  label: string;

  @IsString()
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsEnum(Capability)
  requiredCapability?: Capability | null;
}
