import { spawn } from 'node:child_process'
import { constants, promises as fs } from 'node:fs'
import path from 'node:path'

export async function replaceAppImage(downloadPath: string, targetPath: string): Promise<void> {
  const target = await fs.realpath(targetPath)
  const stagingDir = await fs.mkdtemp(path.join(path.dirname(target), '.typeclub-update-'))
  const stagedFile = path.join(stagingDir, 'TypeClub.AppImage')

  try {
    await fs.copyFile(downloadPath, stagedFile, constants.COPYFILE_EXCL)
    await fs.chmod(stagedFile, 0o755)
    // The running AppImage may still be mounted. Replace its directory entry atomically.
    await fs.rename(stagedFile, target)
  } finally {
    await fs.unlink(stagedFile).catch(() => {})
    await fs.rmdir(stagingDir).catch(() => {})
  }
}

export async function relaunchAppImage(target: string): Promise<void> {
  const env = { ...process.env }
  const oldMount = env.APPDIR
  if (oldMount) {
    for (const key of ['PATH', 'LD_LIBRARY_PATH', 'XDG_DATA_DIRS', 'GSETTINGS_SCHEMA_DIR']) {
      const value = env[key]
      if (!value) continue
      const dirs = value.split(':').filter(dir => dir !== oldMount && !dir.startsWith(`${oldMount}/`))
      if (dirs.length) env[key] = dirs.join(':')
      else delete env[key]
    }
  }
  for (const key of ['APPDIR', 'APPIMAGE', 'ARGV0', 'OWD']) delete env[key]

  const child = spawn('/bin/sh', [
    '-c',
    'while kill -0 "$1" 2>/dev/null; do /bin/sleep 0.2; done; shift; exec "$@"',
    'typeclub-relaunch', String(process.pid), target,
  ], { cwd: path.dirname(target), env, detached: true, stdio: 'ignore' })

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('spawn', resolve)
  })
  child.unref()
}
