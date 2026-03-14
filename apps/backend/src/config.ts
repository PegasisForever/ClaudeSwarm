import z from "zod"
import { readFileSync } from "fs"

const ConfigSchema = z.object({
  presets: z.array(
    z.object({
      name: z.string(),
      imageTag: z.string(),
      presetEnv: z.record(z.string(), z.string()),
      requiredEnv: z.array(z.string()),
    }),
  ),
})

const rawConfig = readFileSync("./config.json", "utf-8")
export const config = ConfigSchema.parse(JSON.parse(rawConfig))