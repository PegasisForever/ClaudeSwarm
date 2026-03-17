function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function readStoredString(key: string) {
  if (!canUseStorage()) {
    return undefined
  }

  return window.localStorage.getItem(key) ?? undefined
}

export function writeStoredString(key: string, value: string) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(key, value)
}

export function getTerminalSelectionKey(id: string) {
  return `claudeswarm-${id}-terminal`
}
