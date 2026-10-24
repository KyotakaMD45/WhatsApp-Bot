const fs = require('fs')
const path = require('path')
const config = require('../config')

const file = path.join(__dirname, '..', 'config.env')
const read = () => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [])
const parseLine = (l) => l.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/)
const SECRET = /KEY|TOKEN|SECRET|SESSION|COOKIE|PASS/i

function setVar(k, v) {
  const lines = read()
  const i = lines.findIndex((l) => parseLine(l)?.[1] === k)
  if (i >= 0) lines[i] = `${k}=${v}`
  else lines.push(`${k}=${v}`)
  fs.writeFileSync(file, lines.join('\n'))
}
function delVar(k) {
  fs.writeFileSync(file, read().filter((l) => parseLine(l)?.[1] !== k).join('\n'))
}
const getVar = (k) => read().map(parseLine).find((m) => m?.[1] === k)?.[2]
const restart = (ctx, msg) => ctx.reply(msg + ' Restarting...').then(() => setTimeout(() => process.exit(0), 1000))

const cmd = (name, desc, run) => ({ cmd: name, desc, category: 'vars', owner: true, run })

module.exports = {
  commands: [
    cmd('setvar', 'Set a variable: setvar PREFIX=!', async (ctx) => {
      const m = ctx.args.match(/^([A-Za-z0-9_]+)\s*[=\s]\s*(.+)$/s)
      if (!m || /[\r\n]/.test(m[2])) return ctx.reply(`Usage: ${ctx.prefix}setvar KEY=value`)
      setVar(m[1].toUpperCase(), m[2].trim())
      await restart(ctx, `${m[1].toUpperCase()} saved.`)
    }),
    cmd('getvar', 'Show a variable', async (ctx) => {
      const k = ctx.args.trim().toUpperCase()
      const v = getVar(k)
      await ctx.reply(v === undefined ? `${k} is not set.` : `${k}=${SECRET.test(k) ? '***' : v}`)
    }),
    cmd('delvar', 'Delete a variable', async (ctx) => {
      const k = ctx.args.trim().toUpperCase()
      if (getVar(k) === undefined) return ctx.reply(`${k} is not set.`)
      delVar(k)
      await restart(ctx, `${k} deleted.`)
    }),
    cmd('allvar', 'List all variables (secrets hidden)', async (ctx) => {
      const out = read().map(parseLine).filter(Boolean).map((m) => `${m[1]}=${SECRET.test(m[1]) ? '***' : m[2]}`)
      await ctx.reply(out.join('\n') || 'config.env is empty.')
    }),
    cmd('setsudo', 'Add a sudo user (mention/reply/number)', async (ctx) => {
      const { targets, num } = require('../lib/utils')
      const t = targets(ctx).map(num)
      if (!t.length) return ctx.reply('Mention, reply to, or type a number.')
      setVar('SUDO', [...new Set([...config.SUDO, ...t])].join(','))
      await restart(ctx, 'Sudo updated.')
    }),
    cmd('getsudo', 'List sudo users', (ctx) => ctx.reply(config.SUDO.join('\n') || 'No sudo users.')),
    cmd('delsudo', 'Remove a sudo user', async (ctx) => {
      const { targets, num } = require('../lib/utils')
      const t = targets(ctx).map(num)
      if (!t.length) return ctx.reply('Mention, reply to, or type a number.')
      setVar('SUDO', config.SUDO.filter((n) => !t.includes(n)).join(','))
      await restart(ctx, 'Sudo updated.')
    }),
  ],
}
