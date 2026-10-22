export type ResetSecurityResult = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  deletedUsers?: (event: string, ...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  deletedProfiles?: (event: string, ...args: any[]) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- kept for v2 compatibility, see docs/v3-breaking-changes.md
  deletedRoles?: (event: string, ...args: any[]) => Promise<any>;
};
