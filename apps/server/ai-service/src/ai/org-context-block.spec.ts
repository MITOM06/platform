import { formatOrgContextBlock } from './org-context-block';

const base = {
  role: 'Manager',
  departmentNames: ['Engineering'],
  profile: { jobTitle: 'Backend Dev', projects: ['PON'], style: 'concise', preferences: 'no emoji' },
  companyEntries: [{ label: 'Mission', text: 'Build the best assistant.' }],
  departmentEntries: [{ label: 'Sprint', text: 'Ship P2 this week.' }],
};

describe('formatOrgContextBlock', () => {
  it('renders identity, profile, and role-filtered entries', () => {
    const out = formatOrgContextBlock(base, 4000);
    expect(out).toContain('## About the user & their organization');
    expect(out).toContain('Manager');
    expect(out).toContain('Engineering');
    expect(out).toContain('Backend Dev');
    expect(out).toContain('PON');
    expect(out).toContain('Mission');
    expect(out).toContain('Ship P2 this week.');
  });

  it('returns empty string when there is nothing to say', () => {
    expect(
      formatOrgContextBlock(
        { departmentNames: [], profile: null, companyEntries: [], departmentEntries: [] },
        4000,
      ),
    ).toBe('');
  });

  it('caps the block length', () => {
    const huge = { ...base, companyEntries: [{ label: 'X', text: 'y'.repeat(10000) }] };
    const out = formatOrgContextBlock(huge, 500);
    expect(out.length).toBeLessThanOrEqual(500);
  });
});
