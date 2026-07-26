export const isOverrideUsedByCurrentProfile = (
  profileConfig: ProfileConfig | undefined,
  overrideId: string,
  isGlobal: boolean | undefined
): boolean => {
  if (isGlobal) return true
  const currentProfile = profileConfig?.items?.find((i) => i.id === profileConfig.current)
  return currentProfile?.override?.includes(overrideId) ?? false
}
