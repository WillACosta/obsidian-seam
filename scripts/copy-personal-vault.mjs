import { copyFileSync, existsSync, lstatSync, mkdirSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN_DIRECTORY = '/Users/will/workspace/obsidian/personal_vault/.obsidian/plugins/seam'
const FILES_TO_COPY = ['manifest.json', 'main.js', 'styles.css']

function removeExistingFile(filePath) {
  try {
    const fileInfo = lstatSync(filePath)
    if (fileInfo.isDirectory()) {
      throw new Error(`Expected a file but found a directory: ${filePath}`)
    }
    unlinkSync(filePath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return
    }
    throw error
  }
}

const missingFiles = FILES_TO_COPY.filter((file) => !existsSync(join(PROJECT_ROOT, file)))
if (missingFiles.length > 0) {
  throw new Error(`Build files are missing: ${missingFiles.join(', ')}. Run the build first.`)
}

mkdirSync(PLUGIN_DIRECTORY, { recursive: true })

for (const file of FILES_TO_COPY) {
  const sourcePath = join(PROJECT_ROOT, file)
  const destinationPath = join(PLUGIN_DIRECTORY, file)
  removeExistingFile(destinationPath)
  copyFileSync(sourcePath, destinationPath)
  console.log(`Copied ${file} to ${destinationPath}`)
}

execFileSync('obsidian', ['vault=personal_vault', 'plugin:reload', 'id=seam'], {
  stdio: 'inherit',
})
