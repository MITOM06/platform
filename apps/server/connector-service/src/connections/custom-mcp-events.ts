import { Injectable, Logger } from '@nestjs/common';
import { McpTool } from '../mcp/mcp-client.service';

/** A custom MCP server just saved, with the tools discovered while saving it. */
export interface SavedCustomMcp {
  /** The stored server document (lean). */
  server: Record<string, unknown> & { _id: unknown };
  /** Tools listed while saving; empty when discovery failed. */
  tools: McpTool[];
}

/**
 * In-process "custom MCP server saved" signal. Lives in ConnectionsModule so
 * InternalModule (which already depends on it) can listen without a circular
 * import: the internal tool cache is primed with the tools the save just
 * discovered, so the first chat after adding a slow server already offers them.
 */
@Injectable()
export class CustomMcpEvents {
  private readonly logger = new Logger(CustomMcpEvents.name);
  private readonly listeners: Array<(saved: SavedCustomMcp) => void> = [];

  onSaved(listener: (saved: SavedCustomMcp) => void): void {
    this.listeners.push(listener);
  }

  saved(event: SavedCustomMcp): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        this.logger.warn(`Custom MCP saved listener failed: ${(err as Error).message}`);
      }
    }
  }
}
