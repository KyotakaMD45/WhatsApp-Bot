const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { loadPlugins } = require('../lib/plugins')

test('loads built-in and optional external plugins', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-bot-plugins-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  for (const directory of ['plugins', 'eplugins']) {
    fs.mkdirSync(path.join(root, directory))
  }

  fs.writeFileSync(
    path.join(root, 'plugins', 'built-in.js'),
    `module.exports = {
      commands: [{ cmd: 'hello', alias: ['hi'], run() {} }],
      hooks: [() => false],
      events: [{ name: 'messages.upsert', run() {} }],
    }`
  )
  fs.writeFileSync(
    path.join(root, 'eplugins', 'external.js'),
    `module.exports = { commands: [{ cmd: 'external', run() {} }] }`
  )

  const plugins = loadPlugins(root)

  assert.deepEqual(plugins.list.map((command) => command.cmd), ['hello', 'external'])
  assert.equal(plugins.commands.get('hi').cmd, 'hello')
  assert.equal(plugins.commands.get('external').cmd, 'external')
  assert.equal(plugins.hooks.length, 1)
  assert.equal(plugins.events.length, 1)
})
