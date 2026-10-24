const fs = require('fs')
const path = require('path')

function loadPlugins(root = path.join(__dirname, '..')) {
  const commands = new Map()
  const hooks = []
  const events = []
  const list = []

  for (const folder of ['plugins', 'eplugins']) {
    const dir = path.join(root, folder)
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.js')).sort()
    for (const file of files) {
      const plugin = require(path.join(dir, file))
      for (const command of plugin.commands || []) {
        list.push(command)
        commands.set(command.cmd, command)
        for (const alias of command.alias || []) commands.set(alias, command)
      }
      hooks.push(...(plugin.hooks || []))
      events.push(...(plugin.events || []))
    }
  }

  return { commands, hooks, events, list }
}

module.exports = { loadPlugins }
