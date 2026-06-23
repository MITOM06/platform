import { model } from 'mongoose';
import { WorkspaceSchema } from '../workspace.schema';

describe('Workspace.aiSettings schema', () => {
  it('defaults aiSettings to an all-null sub-doc (pure env behavior)', () => {
    const Model = model('WorkspaceAiSettingsTest', WorkspaceSchema);
    const doc = new Model({ name: 'Acme' });
    expect(doc.aiSettings).toBeDefined();
    expect(doc.aiSettings.personaName).toBeNull();
    expect(doc.aiSettings.defaultTone).toBeNull();
    expect(doc.aiSettings.modelTier).toBeNull();
    expect(doc.aiSettings.webSearchEnabled).toBeNull();
    expect(doc.aiSettings.thinkingEnabled).toBeNull();
    expect(doc.aiSettings.monthlyTokenLimit).toBeNull();
    expect(doc.aiSettings.allowedConnectors).toBeNull();
  });

  it('accepts a fully populated aiSettings config', () => {
    const Model = model('WorkspaceAiSettingsTest2', WorkspaceSchema);
    const doc = new Model({
      name: 'Acme',
      aiSettings: {
        personaName: 'Acme Bot',
        defaultTone: 'professional',
        modelTier: 'complex',
        webSearchEnabled: false,
        thinkingEnabled: true,
        monthlyTokenLimit: 1000000,
        allowedConnectors: ['gmail', 'notion'],
      },
    });
    expect(doc.aiSettings.personaName).toBe('Acme Bot');
    expect(doc.aiSettings.defaultTone).toBe('professional');
    expect(doc.aiSettings.modelTier).toBe('complex');
    expect(doc.aiSettings.webSearchEnabled).toBe(false);
    expect(doc.aiSettings.thinkingEnabled).toBe(true);
    expect(doc.aiSettings.monthlyTokenLimit).toBe(1000000);
    expect(doc.aiSettings.allowedConnectors).toEqual(['gmail', 'notion']);
  });

  it('distinguishes [] (allow none) from null (inherit)', () => {
    const Model = model('WorkspaceAiSettingsTest3', WorkspaceSchema);
    const doc = new Model({ name: 'Acme', aiSettings: { allowedConnectors: [] } });
    expect(doc.aiSettings.allowedConnectors).toEqual([]);
    expect(doc.aiSettings.allowedConnectors).not.toBeNull();
  });

  it('preserves explicit monthlyTokenLimit = 0 (block all)', () => {
    const Model = model('WorkspaceAiSettingsTest4', WorkspaceSchema);
    const doc = new Model({ name: 'Acme', aiSettings: { monthlyTokenLimit: 0 } });
    expect(doc.aiSettings.monthlyTokenLimit).toBe(0);
  });
});
