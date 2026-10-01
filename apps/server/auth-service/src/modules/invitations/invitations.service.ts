import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import {
  Department,
  DepartmentDocument,
  Invitation,
  InvitationDocument,
  INVITATION_TTL_MS,
  REDIS_CLIENT,
  Redis,
  Role,
  RoleDocument,
} from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import {
  InvitationMutationResponseDto,
  InvitationStatus,
  InvitationStatusFilter,
  InvitationViewDto,
} from './dto/invitation-view.dto';
import { InvitationMailerService } from './invitation-mailer.service';
import { generateInviteToken, hashInviteToken } from './invitation-token.util';
import {
  InvitationActor,
  isDuplicateKey,
  maskEmail,
  MEMBER_ROLE,
  normalizeEmail,
  OWNER_ROLE,
  SYSTEM_INVITER,
} from './invitation.shared';

const RESEND_COOLDOWN_S = 60;
const LIST_LIMIT = 500;
export const resendCooldownKey = (id: string) => `invite_resend_cooldown:${id}`;

/**
 * Admin side of invite-only onboarding (create / list / resend / revoke) plus
 * the lookups used by social provisioning and the boot-time Owner invitation.
 * The raw token never leaves this module except inside the emailed link — not
 * in responses, logs, audit meta or redirects.
 */
@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<InvitationDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
    private readonly mailer: InvitationMailerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async create(
    actor: InvitationActor,
    dto: CreateInvitationDto,
    locale: string,
  ): Promise<InvitationMutationResponseDto> {
    const email = normalizeEmail(dto.email);
    if (await this.usersService.findByEmailInsensitive(email)) {
      throw new ConflictException({ code: AuthCode.MEMBER_ALREADY_EXISTS });
    }

    const role = dto.roleId
      ? await this.roleModel.findById(dto.roleId).exec()
      : await this.roleModel.findOne({ name: MEMBER_ROLE }).exec();
    if (!role) throw new BadRequestException({ code: AuthCode.ROLE_NOT_FOUND });
    if (role.name === OWNER_ROLE && actor.role !== OWNER_ROLE) {
      throw new ForbiddenException({
        code: AuthCode.OWNER_ROLE_ASSIGN_FORBIDDEN,
      });
    }

    const departmentIds = [...new Set(dto.departmentIds ?? [])];
    if (departmentIds.length > 0) {
      const found = await this.departmentModel
        .countDocuments({ _id: { $in: departmentIds } })
        .exec();
      if (found !== departmentIds.length) {
        throw new BadRequestException({ code: AuthCode.DEPARTMENT_NOT_FOUND });
      }
    }

    await this.assertNoLivePending(email);

    const token = generateInviteToken();
    let invitation: InvitationDocument;
    try {
      invitation = await this.invitationModel.create(
        this.newInvitation(
          email,
          role._id,
          departmentIds,
          actor.sub,
          token,
          dto.locale ?? locale,
        ),
      );
    } catch (e) {
      // Partial-unique {email} on pending: a concurrent create won the race.
      if (isDuplicateKey(e)) {
        throw new ConflictException({
          code: AuthCode.INVITATION_ALREADY_PENDING,
        });
      }
      throw e;
    }

    const emailSent = await this.mailer.send(invitation, token);
    await this.audit.record({
      actorId: actor.sub,
      action: 'invitation.create',
      targetType: 'invitation',
      targetId: invitation._id.toString(),
      meta: { email, roleId: role._id.toString(), departmentIds, emailSent },
    });
    const [view] = await this.toViews([invitation]);
    return { invitation: view, emailSent };
  }

  async list(status?: InvitationStatusFilter): Promise<InvitationViewDto[]> {
    const now = new Date();
    let filter: Record<string, unknown>;
    switch (status) {
      case 'pending':
        filter = { status: 'pending', expiresAt: { $gte: now } };
        break;
      case 'expired':
        filter = { status: 'pending', expiresAt: { $lt: now } };
        break;
      case 'accepted':
      case 'revoked':
        filter = { status };
        break;
      case 'all':
        filter = {};
        break;
      default: // actionable = pending + expired
        filter = { status: 'pending' };
    }
    const docs = await this.invitationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .exec();
    return this.toViews(docs);
  }

  async resend(
    actor: InvitationActor,
    id: string,
  ): Promise<InvitationMutationResponseDto> {
    const existing = await this.findByIdOr404(id);
    if (existing.status !== 'pending') {
      throw new ConflictException({ code: AuthCode.INVITATION_NOT_PENDING });
    }
    if (await this.usersService.findByEmailInsensitive(existing.email)) {
      // Invitee got an account meanwhile (e.g. SSO JIT) — the invite is moot.
      await this.markRevoked(existing._id);
      throw new ConflictException({ code: AuthCode.MEMBER_ALREADY_EXISTS });
    }

    const cooldownKey = resendCooldownKey(existing._id.toString());
    const acquired = await this.redis.set(
      cooldownKey,
      '1',
      'EX',
      RESEND_COOLDOWN_S,
      'NX',
    );
    if (acquired !== 'OK') {
      const ttl = Math.max(1, await this.redis.ttl(cooldownKey));
      throw new HttpException(
        { code: AuthCode.INVITATION_RESEND_COOLDOWN, params: { ttl } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = generateInviteToken();
    const now = new Date();
    const updated = await this.invitationModel
      .findOneAndUpdate(
        { _id: existing._id, status: 'pending' },
        {
          $set: {
            tokenHash: hashInviteToken(token),
            expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
            lastSentAt: now,
          },
          $inc: { sendCount: 1 },
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException({ code: AuthCode.INVITATION_NOT_PENDING });
    }

    const emailSent = await this.mailer.send(updated, token);
    await this.audit.record({
      actorId: actor.sub,
      action: 'invitation.resend',
      targetType: 'invitation',
      targetId: updated._id.toString(),
      meta: { email: updated.email, sendCount: updated.sendCount, emailSent },
    });
    const [view] = await this.toViews([updated]);
    return { invitation: view, emailSent };
  }

  async revoke(actor: InvitationActor, id: string): Promise<{ success: true }> {
    const existing = await this.findByIdOr404(id);
    if (!(await this.markRevoked(existing._id))) {
      throw new ConflictException({ code: AuthCode.INVITATION_NOT_PENDING });
    }
    await this.audit.record({
      actorId: actor.sub,
      action: 'invitation.revoke',
      targetType: 'invitation',
      targetId: existing._id.toString(),
      meta: { email: existing.email },
    });
    return { success: true };
  }

  /** Live (pending, unexpired) invitation for an email, if any. */
  findPendingByEmail(email: string): Promise<InvitationDocument | null> {
    return this.invitationModel
      .findOne({
        email: normalizeEmail(email),
        status: 'pending',
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  /**
   * Boot-time Owner invitation (D9). No-op when the email already has an
   * account or a live pending invitation. Mail failure is logged and swallowed.
   */
  async createBootstrapOwnerInvite(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    if (await this.usersService.findByEmailInsensitive(email)) return;
    if (await this.findPendingByEmail(email)) return;
    const ownerRole = await this.roleModel.findOne({ name: OWNER_ROLE }).exec();
    if (!ownerRole) return;

    await this.invitationModel
      .updateMany(
        { email, status: 'pending' }, // only expired ones remain at this point
        { $set: { status: 'revoked', revokedAt: new Date() } },
      )
      .exec();
    const token = generateInviteToken();
    const invitation = await this.invitationModel.create(
      this.newInvitation(email, ownerRole._id, [], SYSTEM_INVITER, token, 'en'),
    );
    const emailSent = await this.mailer.send(invitation, token);
    await this.audit.record({
      actorId: SYSTEM_INVITER,
      action: 'invitation.create',
      targetType: 'invitation',
      targetId: invitation._id.toString(),
      meta: {
        email,
        roleId: ownerRole._id.toString(),
        departmentIds: [],
        emailSent,
      },
    });
    this.logger.log(
      `Bootstrap owner invitation created for ${maskEmail(email)} (emailSent=${emailSent})`,
    );
  }

  // ===================== INTERNALS =====================
  private newInvitation(
    email: string,
    roleId: unknown,
    departmentIds: string[],
    invitedBy: string,
    token: string,
    locale: string,
  ) {
    const now = new Date();
    return {
      email,
      roleId,
      departmentIds,
      invitedBy,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      status: 'pending' as const,
      lastSentAt: now,
      sendCount: 1,
      locale,
    };
  }

  private async findByIdOr404(id: string): Promise<InvitationDocument> {
    const inv = isValidObjectId(id)
      ? await this.invitationModel.findById(id).exec()
      : null;
    if (!inv)
      throw new NotFoundException({ code: AuthCode.INVITATION_NOT_FOUND });
    return inv;
  }

  /** 409 on a live pending invite; an expired pending one is auto-revoked. */
  private async assertNoLivePending(email: string): Promise<void> {
    const pending = await this.invitationModel
      .findOne({ email, status: 'pending' })
      .exec();
    if (!pending) return;
    if (pending.expiresAt.getTime() >= Date.now()) {
      throw new ConflictException({
        code: AuthCode.INVITATION_ALREADY_PENDING,
      });
    }
    await this.markRevoked(pending._id);
  }

  private async markRevoked(id: unknown): Promise<boolean> {
    const res = await this.invitationModel
      .updateOne(
        { _id: id, status: 'pending' },
        { $set: { status: 'revoked', revokedAt: new Date() } },
      )
      .exec();
    return res.modifiedCount > 0;
  }

  /** Batched view mapping: one role query + one user query (no N+1). */
  private async toViews(
    docs: InvitationDocument[],
  ): Promise<InvitationViewDto[]> {
    if (docs.length === 0) return [];
    const roleIds = [
      ...new Set(
        docs.map((d) => d.roleId?.toString()).filter((x): x is string => !!x),
      ),
    ];
    const userIds = [
      ...new Set(
        docs.map((d) => d.invitedBy).filter((id) => id !== SYSTEM_INVITER),
      ),
    ];
    const [roles, users, wsName] = await Promise.all([
      roleIds.length
        ? this.roleModel.find({ _id: { $in: roleIds } }).exec()
        : [],
      this.usersService.findManyByIds(userIds),
      docs.some((d) => d.invitedBy === SYSTEM_INVITER)
        ? this.mailer.workspaceName()
        : Promise.resolve(''),
    ]);
    const roleName = new Map<string, string>(
      (roles as RoleDocument[]).map((r) => [String(r._id), r.name]),
    );
    const userName = new Map<string, string>(
      users.map((u) => [String(u._id), u.displayName]),
    );
    const now = Date.now();

    return docs.map((d) => {
      const status: InvitationStatus =
        d.status === 'pending' && d.expiresAt.getTime() < now
          ? 'expired'
          : d.status;
      const roleId = d.roleId?.toString() ?? '';
      return {
        _id: String(d._id),
        email: d.email,
        roleId,
        roleName: roleName.get(roleId) ?? null,
        departmentIds: (d.departmentIds ?? []).map((x) => x.toString()),
        invitedBy: {
          id: d.invitedBy,
          displayName:
            d.invitedBy === SYSTEM_INVITER
              ? wsName
              : (userName.get(d.invitedBy) ?? null),
        },
        status,
        expiresAt: d.expiresAt.toISOString(),
        createdAt: (d.createdAt ?? d.lastSentAt).toISOString(),
        lastSentAt: (d.lastSentAt ?? d.createdAt).toISOString(),
        sendCount: d.sendCount ?? 1,
        acceptedAt: d.acceptedAt ? d.acceptedAt.toISOString() : null,
        acceptedVia: d.acceptedVia ?? null,
      };
    });
  }
}
