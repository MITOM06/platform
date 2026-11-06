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
  records: { kind: 'SPEECH' | 'FILE' | 'SCREEN'; displayName: string | null; text: string; ts: string }[];
  chat: { senderName: string; content: string; createdAt: string }[];
  sharedNote: string | null;
  /** Newest AI summary of the meeting; absent/null when none exists yet. */
  summary?: MeetingSummary | null;
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
