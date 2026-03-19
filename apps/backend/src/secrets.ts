import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import z from "zod"

const SecretStoreSchema = z.object({
  githubToken: z.string().default(""),
  githubUsername: z.string().default(""),
})

type SecretStore = z.infer<typeof SecretStoreSchema>

function readEnv(name: string, fallback?: string) {
  return process.env[name] ?? fallback
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const secretStorePath =
  readEnv("SECRET_STORE_PATH", resolve(currentDir, "../data/secrets.json")) ??
  resolve(currentDir, "../data/secrets.json")

let secretStore: SecretStore = loadSecretStore()

function loadSecretStore() {
  try {
    if (!existsSync(secretStorePath)) {
      return SecretStoreSchema.parse({})
    }

    return SecretStoreSchema.parse(
      JSON.parse(readFileSync(secretStorePath, "utf-8")),
    )
  } catch (error) {
    console.warn("Failed to read secret store, using defaults:", error)
    return SecretStoreSchema.parse({})
  }
}

function persistSecretStore(nextSecretStore: SecretStore) {
  mkdirSync(dirname(secretStorePath), { recursive: true })
  writeFileSync(secretStorePath, `${JSON.stringify(nextSecretStore, null, 2)}\n`)
  secretStore = nextSecretStore
}

export function getGlobalSettings() {
  return {
    githubUsername: secretStore.githubUsername,
    githubTokenConfigured: secretStore.githubToken.length > 0,
  }
}

export function saveGlobalSettings(input: {
  githubUsername: string
  githubToken?: string
  clearGithubToken?: boolean
}) {
  const nextSecretStore: SecretStore = {
    ...secretStore,
    githubUsername: input.githubUsername,
  }

  if (input.clearGithubToken) {
    nextSecretStore.githubToken = ""
  } else if (input.githubToken) {
    nextSecretStore.githubToken = input.githubToken
  }

  persistSecretStore(nextSecretStore)
  return getGlobalSettings()
}

export function getWorkerSecretEnv() {
  const env: Record<string, string> = {}

  if (process.env.OPENAI_API_KEY) {
    env.OPENAI_API_KEY = process.env.OPENAI_API_KEY
  }

  if (secretStore.githubToken) {
    env.GITHUB_TOKEN = secretStore.githubToken
  }

  if (secretStore.githubUsername) {
    env.GITHUB_USERNAME = secretStore.githubUsername
  }

  return env
}
