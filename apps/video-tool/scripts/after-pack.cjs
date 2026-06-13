const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return
  }

  const projectDir = context.packager.projectDir
  const iconPath = join(projectDir, 'build', 'icon.ico')
  const exePath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const rceditCandidates = [
    resolve(
      projectDir,
      '..',
      '..',
      'node_modules',
      '.pnpm',
      'electron-winstaller@5.4.0',
      'node_modules',
      'electron-winstaller',
      'vendor',
      'rcedit.exe'
    ),
    resolve(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe')
  ]
  const rceditPath = rceditCandidates.find((candidate) => existsSync(candidate))

  if (!existsSync(iconPath)) {
    throw new Error(`HoodMagic icon not found: ${iconPath}`)
  }
  if (!existsSync(exePath)) {
    throw new Error(`Packaged executable not found: ${exePath}`)
  }
  if (!rceditPath) {
    throw new Error('rcedit.exe was not found; cannot apply the HoodMagic executable icon.')
  }

  const result = spawnSync(rceditPath, [exePath, '--set-icon', iconPath], {
    encoding: 'utf8',
    stdio: 'pipe'
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'rcedit failed while applying executable icon.')
  }
}
