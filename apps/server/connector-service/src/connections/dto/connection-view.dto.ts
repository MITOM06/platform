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
