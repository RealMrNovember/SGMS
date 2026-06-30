export function userMessageChannel(organizationId: string, userId: string) {
  return `private-org.${organizationId}.user.${userId}`;
}

export function orgStaffChannel(organizationId: string) {
  return `private-org.${organizationId}.staff`;
}
