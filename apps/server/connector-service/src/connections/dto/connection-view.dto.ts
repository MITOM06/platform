/**
 * Public, secret-free view of a user connection. NEVER includes
 * encryptedTokens or any credential material.
 */
export interface ConnectionView {
  id: string;
  provider: string;
  status: string;
  /** 'personal' | 'workspace' — workspace connections are shared org-wide. */
  scope: string;
  scopes: string[];
  /** Action groups the AI may use on this connection: view/create/edit/delete. */
  actionGroups: string[];
  /** Permitted writes run without the in-chat confirmation card. */
  autoRun: boolean;
  accountLabel?: string;
  lastUsedAt?: Date;
}

export interface ToolPreviewView {
  name: string;
  description: string;
}

export interface DiscoverResult {
  tools: ToolPreviewView[];
}
