import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  InvitationDocument,
  Role,
  RoleDocument,
  Workspace,
  WorkspaceDocument,
} from '@platform/database';
import { MailService } from '../Email/mail.service';
import { WelcomeVariant } from '../Email/welcome-i18n';
import { UsersService } from '../users/users.service';
import { buildInviteUrl, buildWebLoginUrl } from './invitation-token.util';
import { maskEmail, MEMBER_ROLE, SYSTEM_INVITER } from './invitation.shared';

/**
 * Renders + sends invitation and welcome emails and resolves the display names
 * shown to the invitee (workspace, inviter, role). A mail failure never fails
 * the caller: `send` returns false / `sendWelcome` resolves, and only the
 * recipient domain + provider code are logged.
 */
@Injectable()
export class InvitationMailerService {
  private readonly logger = new Logger(InvitationMailerService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Workspace.name)
    private readonly workspaceModel: Model<WorkspaceDocument>,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async send(inv: InvitationDocument, token: string): Promise<boolean> {
    try {
      const [workspaceName, role] = await Promise.all([
        this.workspaceName(),
        this.roleModel.findById(inv.roleId).exec(),
      ]);
      await this.mail.sendInviteEmail(
        inv.email,
        {
          inviteUrl: buildInviteUrl(this.config, token),
          workspaceName,
          inviterName: await this.inviterName(inv.invitedBy, workspaceName),
          roleName: role?.name ?? MEMBER_ROLE,
        },
        inv.locale,
      );
      return true;
    } catch (e) {
      this.logSendFailure('INVITE_SEND_FAILED', inv.email, e);
      return false;
    }
  }

  /**
   * Welcome email after an accepted invitation (`google` adds the "create your
   * PON password" next step). Never rejects: callers fire and forget it.
   */
  async sendWelcome(
    inv: InvitationDocument,
    displayName: string,
    variant: WelcomeVariant,
  ): Promise<void> {
    try {
      const [workspaceName, role] = await Promise.all([
        this.workspaceName(),
        this.roleModel.findById(inv.roleId).exec(),
      ]);
      await this.mail.sendWelcomeEmail(
        inv.email,
        {
          loginUrl: buildWebLoginUrl(this.config),
          displayName,
          workspaceName,
          roleName: role?.name ?? MEMBER_ROLE,
          variant,
        },
        inv.locale,
      );
    } catch (e) {
      this.logSendFailure('WELCOME_SEND_FAILED', inv.email, e);
    }
  }

  async workspaceName(): Promise<string> {
    const ws = await this.workspaceModel.findOne().exec();
    return ws?.name || 'PON';
  }

  /** Inviter display name; the workspace name for system / deleted inviters. */
  async inviterName(invitedBy: string, workspaceName: string): Promise<string> {
    if (invitedBy === SYSTEM_INVITER) return workspaceName;
    const user = await this.usersService.findById(invitedBy);
    return user?.displayName || workspaceName;
  }

  /** Same PII rule as deliverOtpEmail: recipient domain + provider error code only. */
  private logSendFailure(tag: string, email: string, e: unknown): void {
    const err = e as { code?: string } | undefined;
    const symptom = err?.code ?? (e instanceof Error ? e.name : typeof e);
    this.logger.error(
      `${tag} recipient=${maskEmail(email)} symptom=${symptom}`,
    );
  }
}
