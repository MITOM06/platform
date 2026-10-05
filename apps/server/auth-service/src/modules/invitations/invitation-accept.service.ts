import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  Department,
  DepartmentDocument,
  Invitation,
  InvitationAcceptedVia,
  InvitationDocument,
  REDIS_CLIENT,
  Redis,
  Role,
  RoleDocument,
  User,
  UserDocument,
} from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import { AuditService } from '../audit/audit.service';
import { WelcomeVariant } from '../Email/welcome-i18n';
import { UsersService } from '../users/users.service';
import { AcceptInvitationPasswordDto } from './dto/accept-invitation.dto';
import { InvitationPreviewDto } from './dto/invitation-view.dto';
import { InvitationMailerService } from './invitation-mailer.service';
import {
  generateFlowId,
  hashInviteToken,
  isWellFormedInviteToken,
} from './invitation-token.util';
import { isDuplicateKey, normalizeEmail } from './invitation.shared';

/** Profile fields from Google needed to create the invitee. */
export interface InviteSocialProfile {
  id?: string;
  email?: string;
  displayName?: string;
  avatar?: string;
}

const GOOGLE_FLOW_TTL_S = 600;
export const inviteOauthKey = (flowId: string) => `invite_oauth:${flowId}`;

/**
 * Public side of invite-only onboarding: preview, accept with password, the
 * Google accept round-trip, and SSO JIT consumption. Accept is atomic — a
 * conditional findOneAndUpdate lets exactly one concurrent accept win.
 */
@Injectable()
export class InvitationAcceptService {
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

  async preview(token: string): Promise<InvitationPreviewDto> {
    const inv = await this.findByToken(token);
    this.assertAcceptable(inv);
    const [workspaceName, role] = await Promise.all([
      this.mailer.workspaceName(),
      this.roleModel.findById(inv.roleId).exec(),
    ]);
    return {
      email: inv.email,
      workspaceName,
      inviterName: await this.mailer.inviterName(inv.invitedBy, workspaceName),
      roleName: role?.name ?? null,
      expiresAt: inv.expiresAt.toISOString(),
    };
  }

  /** Throws the typed error for a non-acceptable invitation. */
  assertAcceptable(inv: InvitationDocument): void {
    if (inv.status === 'accepted') {
      throw new ConflictException({
        code: AuthCode.INVITATION_ALREADY_ACCEPTED,
      });
    }
    if (inv.status === 'revoked') {
      throw new GoneException({ code: AuthCode.INVITATION_REVOKED });
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      throw new GoneException({ code: AuthCode.INVITATION_EXPIRED });
    }
  }

  async acceptWithPassword(
    token: string,
    dto: AcceptInvitationPasswordDto,
  ): Promise<UserDocument> {
    const inv = await this.findByToken(token);
    this.assertAcceptable(inv);
    const password = await bcrypt.hash(dto.password, await bcrypt.genSalt(10));
    const user = await this.claimAndCreateUser(inv, 'password', {
      displayName: dto.displayName.trim(),
      password,
    });
    this.sendWelcome(inv, user, 'password');
    return user;
  }

  /** Validates the invitation; returns a single-use flow id for the Google round-trip. */
  async startGoogleFlow(token: string): Promise<string> {
    const inv = await this.findByToken(token);
    this.assertAcceptable(inv);
    const flowId = generateFlowId();
    await this.redis.set(
      inviteOauthKey(flowId),
      inv._id.toString(),
      'EX',
      GOOGLE_FLOW_TTL_S,
    );
    return flowId;
  }

  /**
   * Completes the Google invite flow; returns the new user's id. On an email
   * mismatch the invitation stays pending (the flow id is consumed regardless).
   */
  async acceptWithGoogle(
    flowId: string,
    profile: InviteSocialProfile,
  ): Promise<string> {
    const invId = await this.redis.getdel(inviteOauthKey(flowId));
    const inv =
      invId && isValidObjectId(invId)
        ? await this.invitationModel.findById(invId).exec()
        : null;
    if (!inv)
      throw new NotFoundException({ code: AuthCode.INVITATION_INVALID });
    this.assertAcceptable(inv);

    if (!profile?.email) {
      throw new UnauthorizedException({
        code: AuthCode.SOCIAL_EMAIL_UNAVAILABLE,
      });
    }
    if (normalizeEmail(profile.email) !== inv.email) {
      throw new ForbiddenException({
        code: AuthCode.INVITATION_EMAIL_MISMATCH,
      });
    }
    const user = await this.claimAndCreateUser(inv, 'google', {
      displayName: profile.displayName || inv.email.split('@')[0],
      avatarUrl: profile.avatar || '',
      socialLinks: profile.id ? { google: profile.id } : {},
      // The ONLY place this flag is set: clients ask a Google invitee to create
      // a PON password before using the app (an onboarding step, not a security
      // boundary — any password change / reset clears it).
      mustSetPassword: true,
    });
    this.sendWelcome(inv, user, 'google');
    return user._id.toString();
  }

  /** SSO JIT: create the user from a live invitation (role/depts from the invite). */
  acceptWithSso(
    inv: InvitationDocument,
    data: Partial<User>,
  ): Promise<UserDocument> {
    return this.claimAndCreateUser(inv, 'oidc', data);
  }

  /** Mark a live invitation accepted for a user created elsewhere (bootstrap owner). */
  async consumeForUser(
    invitationId: unknown,
    userId: string,
    via: InvitationAcceptedVia,
  ): Promise<void> {
    await this.invitationModel
      .updateOne(
        { _id: invitationId, status: 'pending' },
        {
          $set: {
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedVia: via,
            acceptedUserId: userId,
          },
        },
      )
      .exec();
  }

  // ===================== INTERNALS =====================
  /** Fire-and-forget: the welcome email never fails or delays an accept. */
  private sendWelcome(
    inv: InvitationDocument,
    user: UserDocument,
    variant: WelcomeVariant,
  ): void {
    void this.mailer
      .sendWelcome(inv, user.displayName, variant)
      .catch(() => undefined);
  }

  /**
   * Atomically claim the invitation (exactly one concurrent accept wins), then
   * create the user. Any user-creation failure reverts the claim to pending; a
   * duplicate-email race surfaces as MEMBER_ALREADY_EXISTS.
   */
  private async claimAndCreateUser(
    inv: InvitationDocument,
    via: InvitationAcceptedVia,
    data: Partial<User>,
  ): Promise<UserDocument> {
    if (await this.usersService.findByEmailInsensitive(inv.email)) {
      throw new ConflictException({ code: AuthCode.MEMBER_ALREADY_EXISTS });
    }
    const now = new Date();
    const claimed = await this.invitationModel
      .findOneAndUpdate(
        { _id: inv._id, status: 'pending', expiresAt: { $gt: now } },
        { $set: { status: 'accepted', acceptedAt: now, acceptedVia: via } },
        { new: true },
      )
      .exec();
    if (!claimed) {
      // Lost the race (or it expired/was revoked in between): report why.
      const fresh = await this.invitationModel.findById(inv._id).exec();
      if (fresh) this.assertAcceptable(fresh);
      throw new NotFoundException({ code: AuthCode.INVITATION_INVALID });
    }

    const { roleId, departmentIds } = await this.existingAssignment(claimed);
    let user: UserDocument;
    try {
      user = await this.usersService.create({
        ...data,
        email: claimed.email,
        isVerified: true,
        status: 'active',
        ...(roleId ? { roleId } : {}),
        departmentIds,
      });
    } catch (e) {
      await this.invitationModel
        .updateOne(
          { _id: claimed._id, status: 'accepted' },
          {
            $set: { status: 'pending' },
            $unset: { acceptedAt: '', acceptedVia: '' },
          },
        )
        .exec();
      if (isDuplicateKey(e)) {
        throw new ConflictException({ code: AuthCode.MEMBER_ALREADY_EXISTS });
      }
      throw e;
    }

    const userId = user._id.toString();
    await this.invitationModel
      .updateOne({ _id: claimed._id }, { $set: { acceptedUserId: userId } })
      .exec();
    await this.audit.record({
      actorId: userId,
      action: 'invitation.accept',
      targetType: 'invitation',
      targetId: claimed._id.toString(),
      meta: { email: claimed.email, via },
    });
    return user;
  }

  /** Role/departments from the invitation, filtered to ones that still exist. */
  private async existingAssignment(inv: InvitationDocument): Promise<{
    roleId?: Types.ObjectId;
    departmentIds: Types.ObjectId[];
  }> {
    const role = inv.roleId
      ? await this.roleModel.findById(inv.roleId).exec()
      : null;
    const ids = inv.departmentIds ?? [];
    const depts = ids.length
      ? await this.departmentModel
          .find({ _id: { $in: ids } })
          .select('_id')
          .exec()
      : [];
    return {
      roleId: role ? (role._id as Types.ObjectId) : undefined,
      departmentIds: depts.map((d) => d._id as Types.ObjectId),
    };
  }

  private async findByToken(token: string): Promise<InvitationDocument> {
    if (!isWellFormedInviteToken(token)) {
      throw new NotFoundException({ code: AuthCode.INVITATION_INVALID });
    }
    const inv = await this.invitationModel
      .findOne({ tokenHash: hashInviteToken(token) })
      .exec();
    if (!inv)
      throw new NotFoundException({ code: AuthCode.INVITATION_INVALID });
    return inv;
  }
}
