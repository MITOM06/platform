import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema, Types } from 'mongoose';

export type DepartmentDocument = Department & Document;

/**
 * A named group of members within the company (phòng ban). Owns department
 * group chats and department-scoped knowledge. Member↔department membership is
 * embedded on the User (`departmentIds`), not duplicated here.
 */
@NestSchema({ timestamps: true })
export class Department {
  @Prop({ required: true, index: true })
  name: string;

  @Prop()
  description?: string;

  /** Optional department lead (a userId). */
  @Prop({ type: Schema.Types.ObjectId })
  leadUserId?: Types.ObjectId;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
