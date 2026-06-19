/**
 * Public, secret-free view of a user connection. NEVER includes
 * encryptedTokens or any credential material.
 */
export interface ConnectionView {
  id: string;
  provider: string;
  status: string;
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
