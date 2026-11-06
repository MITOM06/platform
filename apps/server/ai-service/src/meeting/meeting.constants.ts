/** DI token for the dedicated Redis subscriber connection used by the meeting module. */
export const MEETING_REDIS_SUBSCRIBER = 'MEETING_REDIS_SUBSCRIBER';
/** chat-service -> ai-service: request a summary of a finished meeting. */
export const MEETING_SUMMARIZE_CHANNEL = 'meet:summarize';
/** ai-service -> chat-service: the outcome of a summary request. */
export const MEETING_SUMMARY_RESULT_CHANNEL = 'meet:summary:result';

/** Inbound `meet:summarize` message. */
export interface MeetingSummarizeMessage {
  meetingId: string;
  attempt: string;
  requesterId: string;
}

/** Shape of the chat-service internal meeting record (Java record via Jackson). */
export interface MeetingRecordView {
  meeting: {
    id: string;
    title: string | null;
    code: string;
    startedAt: string | null;
    endedAt: string | null;
    hostName: string | null;
  };
  attendees: { displayName: string }[];
  records: { kind: 'SPEECH' | 'FILE' | 'SCREEN'; displayName: string | null; text: string; ts: string; fileName?: string | null }[];
  chat: { senderName: string; content: string; createdAt: string; attachmentName?: string | null }[];
  sharedNote: string | null;
  /** Newest AI summary of the meeting; absent/null when none exists yet. */
  summary?: MeetingSummary | null;
}

/** One row of chat-service `GET /internal/meetings` (title may be absent). */
export interface MeetingListItem {
  id: string;
  title?: string | null;
  code: string;
  startedAt: string | null;
  endedAt: string | null;
  summaryState: string | null;
}

export interface MeetingActionItem {
  text: string;
  assigneeName: string | null;
}

/** Structured summary produced by the model. */
export interface MeetingSummary {
  overview: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  fromMaterials: string[];
  language: string;
}

export type MeetingSummaryStatus = 'ok' | 'empty' | 'failed';

/** chat-service -> ai-service: read a file sent in the meeting chat. */
export const MEETING_MATERIAL_CHANNEL = 'meet:material';
/** ai-service -> chat-service: the extracted text (or why there is none). */
export const MEETING_MATERIAL_RESULT_CHANNEL = 'meet:material:result';

/** Inbound `meet:material` message. */
export interface MeetingMaterialMessage {
  meetingId: string;
  messageId: string;
  uploadId: string;
  fileName: string;
  mimeType?: string | null;
  userId: string;
  /** Absent means "file". For "screen", messageId is the frame id and uploadId the GridFS file. */
  kind?: MeetingMaterialKind;
}

export type MeetingMaterialKind = 'file' | 'screen';

export type MeetingMaterialStatus = 'ok' | 'unsupported' | 'failed';
