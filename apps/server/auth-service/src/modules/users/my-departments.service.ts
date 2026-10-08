import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Department,
  DepartmentDocument,
  User,
  UserDocument,
} from '@platform/database';
import { isObjectIdString } from '../../common/ids';
import { MyDepartmentDto } from './dto/my-department.dto';

/**
 * The caller's own departments with their names — for members without
 * `MANAGE_DEPARTMENTS` (who cannot read `GET /api/admin/departments`), e.g. to
 * pick a department when creating a meeting. Membership lives on the user
 * (`departmentIds`); ids whose department was deleted are skipped.
 */
@Injectable()
export class MyDepartmentsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Department.name)
    private readonly deptModel: Model<DepartmentDocument>,
  ) {}

  /** `[{id, name}]` sorted by name (case-insensitive, then id); `[]` when none. */
  async listMine(userId: string): Promise<MyDepartmentDto[]> {
    if (!isObjectIdString(userId)) return [];
    const user = (await this.userModel
      .findById(userId)
      .select('departmentIds')
      .lean()
      .exec()) as { departmentIds?: unknown[] } | null;
    const ids = Array.from(
      new Set((user?.departmentIds ?? []).map(String).filter(isObjectIdString)),
    );
    if (ids.length === 0) return [];

    const docs = (await this.deptModel
      .find({ _id: { $in: ids } })
      .select('name')
      .lean()
      .exec()) as { _id: unknown; name?: unknown }[];
    return docs
      .map((d) => ({
        id: String(d._id),
        name: typeof d.name === 'string' ? d.name.trim() : '',
      }))
      .filter((d) => d.name.length > 0)
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) ||
          a.id.localeCompare(b.id),
      );
  }
}
