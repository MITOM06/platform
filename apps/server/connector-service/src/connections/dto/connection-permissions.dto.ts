import { ArrayUnique, IsArray, IsIn } from 'class-validator';

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
}

export interface ConnectionPermissionsView {
  actionGroups: string[];
}
