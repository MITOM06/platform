import { ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional } from 'class-validator';

/**
 * Set the action groups the AI may use on a connection. userId + connection id
 * come from the JWT + path — never the body. An empty array = view/create/edit/
 * delete all OFF (the connection is linked but the AI can't act through it).
 */
export class UpdateConnectionPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(['view', 'create', 'edit', 'delete'], { each: true })
  actionGroups: string[];

  /**
   * Full authority: permitted writes run without the confirmation card.
   * Omitted = unchanged (older clients only send the groups).
   */
  @IsOptional()
  @IsBoolean()
  autoRun?: boolean;
}

export interface ConnectionPermissionsView {
  actionGroups: string[];
  autoRun: boolean;
}
