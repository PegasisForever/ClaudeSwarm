export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getDefaultShell() {
  return process.env.SHELL?.trim() || "zsh"
}

export function getWorkspaceDir() {
  const workspaceDir = process.env.WORKSPACE_DIR?.trim()
  if (workspaceDir) {
    return workspaceDir
  }

  const homeDir = process.env.HOME?.trim() || "/home/kasm-user"
  return `${homeDir}/workers`
}

export function shellEscape(value: string) {
  if (value.length === 0) {
    return "''"
  }

  return `'${value.replace(/'/g, `'\\''`)}'`
}
