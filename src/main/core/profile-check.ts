import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import { getAppConfig, getProfileConfig } from '../config'
import { mihomoCorePath, mihomoTestDir, mihomoWorkConfigPath } from '../utils/dirs'

export async function checkProfile(): Promise<void> {
  const [appConfig, profileConfig] = await Promise.all([getAppConfig(), getProfileConfig()])
  const { core = 'mihomo', diffWorkDir = false, safePaths = [] } = appConfig
  const { current } = profileConfig
  const corePath = mihomoCorePath(core)
  const execFilePromise = promisify(execFile)
  const env = {
    ...process.env,
    SAFE_PATHS: safePaths.join(path.delimiter)
  }
  try {
    await execFilePromise(
      corePath,
      [
        '-t',
        '-f',
        diffWorkDir ? mihomoWorkConfigPath(current) : mihomoWorkConfigPath('work'),
        '-d',
        mihomoTestDir()
      ],
      { env }
    )
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    const execError = error as Error & {
      stdout?: string
      stderr?: string
    }
    const output = [execError.stdout, execError.stderr]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join('\n')
    const errorLines = output
      .split('\n')
      .filter((line) => line.includes('level=error'))
      .map((line) => line.split('level=error', 2)[1]?.trim() || line.trim())
    const message = errorLines.join('\n') || output.trim() || error.message
    throw new Error(`Profile Check Failed:\n${message}`)
  }
}
