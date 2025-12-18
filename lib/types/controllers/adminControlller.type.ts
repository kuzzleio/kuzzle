export type ResetSecurityResult = {
  deletedUsers?: (event: string, ...args: any[]) => Promise<any>;
  deletedProfiles?: (event: string, ...args: any[]) => Promise<any>;
  deletedRoles?: (event: string, ...args: any[]) => Promise<any>;
};
