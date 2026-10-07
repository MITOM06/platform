import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MyDepartmentDto } from './dto/my-department.dto';
import { MyDepartmentsService } from './my-departments.service';

/**
 * `GET /api/users/me/departments` — kept out of `UsersController` (and its
 * service) so neither grows past the file-size limit. Two static segments, so
 * it never collides with `GET /api/users/:id` or `/:id/relationship`.
 */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/users')
export class MyDepartmentsController {
  constructor(private readonly myDepartments: MyDepartmentsService) {}

  @Get('me/departments')
  @ApiOperation({
    summary:
      "The caller's own departments as {id, name}, sorted by name — no capability needed",
  })
  @ApiOkResponse({ type: [MyDepartmentDto] })
  listMine(@Req() req: any): Promise<MyDepartmentDto[]> {
    return this.myDepartments.listMine(req.user.sub);
  }
}
