import { model } from 'mongoose';
import { WorkspaceSchema } from '../workspace.schema';

describe('Workspace.sso schema', () => {
  it('defaults sso.enabled to false and arrays/maps to empty', () => {
    const Model = model('WorkspaceSsoTest', WorkspaceSchema);
    const doc = new Model({ name: 'Acme' });
    expect(doc.sso.enabled).toBe(false);
    expect(doc.sso.allowedDomains).toEqual([]);
    expect(doc.sso.groupRoleMap).toBeDefined();
    expect(doc.sso.groupDeptMap).toBeDefined();
  });

  it('accepts a populated sso config', () => {
    const Model = model('WorkspaceSsoTest2', WorkspaceSchema);
    const doc = new Model({
      name: 'Acme',
      sso: {
        enabled: true,
        allowedDomains: ['acme.com'],
        groupRoleMap: { 'pon-admins': 'Admin' },
        groupDeptMap: { eng: '507f1f77bcf86cd799439011' },
        defaultRole: 'Member',
      },
    });
    expect(doc.sso.enabled).toBe(true);
    expect(doc.sso.allowedDomains).toEqual(['acme.com']);
    expect(doc.sso.groupRoleMap['pon-admins']).toBe('Admin');
    expect(doc.sso.defaultRole).toBe('Member');
  });
});
