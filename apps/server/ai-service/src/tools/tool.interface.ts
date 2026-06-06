export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required: string[] };
}

export interface ToolContext {
  conversationId: string;
  userId: string;
  displayName: string;
}
