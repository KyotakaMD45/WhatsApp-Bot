const { execFile } = require('child_process')
const os = require('os')
const path = require('path')

const run = (cmd, args, timeout = 120000) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout, maxBuffer: 1e7 }, (e, stdout, stderr) => {
      if (!e) return resolve(String(stdout))
      if (e.code === 'ENOENT') return reject(new Error(`${cmd} is not installed on the server`))
      reject(new Error(String(stderr || e.message).slice(-300)))
    })
  )

const tmp = (ext) => path.join(os.tmpdir(), `bot-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)

const fs = require('fs')

// write buffer to a temp file, run fn(inputPath, outputPath), return output buffer, clean up
async function withTmp(inExt, outExt, buffer, fn) {
  const inp = tmp(inExt)
  const out = tmp(outExt)
  fs.writeFileSync(inp, buffer)
  try {
    await fn(inp, out)
    return fs.readFileSync(out)
  } finally {
    for (const f of [inp, out]) fs.rm(f, { force: true }, () => {})
  }
}

module.exports = { run, tmp, withTmp }
