export function userMessageChannel(organizationId: string, userId: string) {
  return `private-org.${organizationId}.user.${userId}`;
}
