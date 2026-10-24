const config = require('../config')
const os = require('os')
const db = require('../lib/db')
const version = require('../package.json').version

const SMALL = Array.from('ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ')
const small = (text) =>
  Array.from(text.toLowerCase())
    .map((ch) => (/[a-z]/.test(ch) ? SMALL[ch.charCodeAt(0) - 97] || ch : ch))
    .join('')
const mono = (t) =>
  Array.from(t).map((ch) => {
    const c = ch.charCodeAt(0)
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d670 + c - 65)
    if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7f6 + c - 48)
    return ch
  }).join('')

const formatUptime = (seconds) => {
  const total = Math.floor(seconds)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainingSeconds = total % 60
  const parts = []

  if (days) parts.push(`${days}d`)
  if (hours || days) parts.push(`${hours}h`)
  if (minutes || hours || days) parts.push(`${minutes}m`)
  parts.push(`${remainingSeconds}s`)
  return parts.join(' ')
}

const formatCommands = (commands) => {
  const categories = new Map()
  for (const command of commands) {
    const category = command.category || 'general'
    if (!categories.has(category)) categories.set(category, [])
    categories.get(category).push(command.cmd)
  }

  return [...categories.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((category) => {
      const names = [...new Set(categories.get(category))]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ` │ ${mono(name.toUpperCase())}`)
        .join('\n')
      return `\n ╭─❏ ${small(category)} ❏\n${names}\n ╰─────────────────`
    })
    .join('')
}

module.exports = {
  commands: [
    {
      cmd: 'menu',
      alias: ['help'],
      desc: 'Show all commands',
      category: 'general',
      run: async (ctx) => {
        const now = new Date()
        const locale = config.BOT_LANG === 'fr' ? 'fr-FR' : 'en-US'
        const mb = (n) => Math.round(n / 1048576)
        const header = [
          `${ctx.t('menu.prefix')} : ${ctx.prefix}`,
          `${ctx.t('menu.bot')} : ${config.BOT_NAME}`,
          `${ctx.t('menu.time')} : ${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`,
          `${ctx.t('menu.day')} : ${now.toLocaleDateString(locale, { weekday: 'long' })}`,
          `${ctx.t('menu.date')} : ${now.toLocaleDateString(locale)}`,
          `${ctx.t('menu.version')} : ${version}`,
          `${ctx.t('menu.commands')} : ${ctx.plugins.list.length}`,
          `${ctx.t('menu.ram')} : ${mb(process.memoryUsage().rss)}/${mb(os.totalmem())}MB`,
          `${ctx.t('menu.uptime')} : ${formatUptime(process.uptime())}`,
          `${ctx.t('menu.platform')} : ${os.type()} ${os.arch()}`,
          `${ctx.t('menu.mode')} : ${db.mode()}`,
        ]
        const out =
          `\`\`\`╭═══ ${config.BOT_NAME.toUpperCase()} ═══⊷\n` +
          `┃❃╭──────────────\n${header.map((line) => `┃❃│ ${line}`).join('\n')}\n` +
          `┃❃╰───────────────\n╰═════════════════⊷\`\`\`` +
          formatCommands(ctx.plugins.list)
        await ctx.reply(out)
      },
    },
    {
      cmd: 'ping',
      desc: 'Check that the bot is alive',
      category: 'general',
      run: async (ctx) => {
        const t = Date.now()
        await ctx.reply(ctx.t('ping.response', { ms: Date.now() - t }))
      },
    },
    {
      cmd: 'mode',
      desc: 'Set mode: public or private',
      category: 'general',
      owner: true,
      run: async (ctx) => {
        const v = ctx.args.trim().toLowerCase()
        if (!['public', 'private'].includes(v)) {
          return ctx.reply(ctx.t('mode.usage', { prefix: ctx.prefix, mode: db.mode() }))
        }
        db.setMode(v)
        await ctx.reply(ctx.t('mode.updated', { mode: v }))
      },
    },
  ],
}
