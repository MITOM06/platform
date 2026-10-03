import { Prop, Schema as NestSchema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema, Types } from "mongoose";

export type InvitationDocument = Invitation & Document;

/** Stored invitation lifecycle. `expired` is DERIVED on read (pending && expiresAt < now). */
export type InvitationStoredStatus = "pending" | "accepted" | "revoked";

/** How an invitation was accepted. */
export type InvitationAcceptedVia = "password" | "google" | "oidc";

/** Invitation links are valid for 7 days (resend rotates the token and resets this). */
export const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000;

/**
 * Admin-issued invitation for invite-only onboarding. The User doc is created
 * only when the invitation is accepted, so a pending invite never occupies the
 * unique email index on `users` nor leaks into user lookups.
 *
 * Security: only `sha256(token)` is persisted (`tokenHash`). The raw token
 * exists solely in the emailed link and is never returned by any API.
 */
@NestSchema({ collection: "invitations", timestamps: true })
export class Invitation {
  /** Invited email, stored lowercase + trimmed. */
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /** Role assigned on accept (server defaults to the preset Member role). */
  @Prop({ type: Schema.Types.ObjectId, required: true })
  roleId: Types.ObjectId;

  @Prop({ type: [Schema.Types.ObjectId], default: [] })
  departmentIds: Types.ObjectId[];

  /** Inviter user id, or `'system'` for the boot-time Owner invitation. */
  @Prop({ required: true })
  invitedBy: string;

  /** sha256 hex of the raw invitation token. */
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({
    type: String,
    enum: ["pending", "accepted", "revoked"],
    default: "pending",
  })
  status: InvitationStoredStatus;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  acceptedUserId?: string;

  @Prop({ type: String, enum: ["password", "google", "oidc"] })
  acceptedVia?: InvitationAcceptedVia;

  @Prop()
  revokedAt?: Date;

  @Prop()
  lastSentAt: Date;

  @Prop({ default: 1 })
  sendCount: number;

  /** Language of the invitation email (one of the 7 supported locales). */
  @Prop({ default: "en" })
  locale: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);

// Admin list: "actionable invitations, newest first".
InvitationSchema.index({ status: 1, createdAt: -1 });

// At most ONE pending invitation per email (also serves email lookups; a
// second plain {email:1} index would clash on the auto-generated name). Revoked/accepted rows are history
// and do not block a re-invite.
InvitationSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
