import { ApiProperty } from '@nestjs/swagger';

/** One of the caller's own departments — `GET /api/users/me/departments`. */
export class MyDepartmentDto {
  @ApiProperty({ example: '66aa00000000000000000009' })
  id: string;

  @ApiProperty({ example: 'Engineering' })
  name: string;
}
