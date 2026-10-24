const config = require('../config')
const db = require('../lib/db')

// store: { chats: {jid: {trigger: reply}}, groups: {trigger: reply}, private: {trigger: reply} }
const store = () => db.kv('filters', { chats: {}, groups: {}, private: {} })

const add = (cmd, scope, desc) => ({
  cmd,
  desc,
  category: 'autoreply',
  owner: true,
  run: async (ctx) => {
    const i = ctx.args.indexOf(':')
    if (i < 1) return ctx.reply(`Usage: ${ctx.prefix}${cmd} trigger:reply`)
    const trigger = ctx.args.slice(0, i).trim().toLowerCase()
    const reply = ctx.args.slice(i + 1).trim()
    const s = store()
    const bucket = scope === 'chat' ? (s.chats[ctx.jid] ??= {}) : s[scope]
    bucket[trigger] = reply
    db.save()
    await ctx.reply(`Filter saved: "${trigger}"`)
  },
})

const del = (cmd, scope, desc) => ({
  cmd,
  desc,
  category: 'autoreply',
  owner: true,
  run: async (ctx) => {
    const s = store()
    const bucket = scope === 'chat' ? s.chats[ctx.jid] || {} : s[scope]
    const t = ctx.args.trim().toLowerCase()
    if (!t) return ctx.reply(`Filters here: ${Object.keys(bucket).join(', ') || '(none)'}\nUsage: ${ctx.prefix}${cmd} trigger`)
    delete bucket[t]
    db.save()
    await ctx.reply(`Filter removed: "${t}"`)
  },
})

async function auto(ctx) {
  if (!ctx.text || ctx.text.startsWith(config.PREFIX.find((p) => ctx.text.startsWith(p)) || '\u0000')) return false
  const s = store()
  const t = ctx.text.toLowerCase()
  const buckets = [s.chats[ctx.jid] || {}, ctx.isGroup ? s.groups : s.private]
  for (const b of buckets) {
    for (const [trigger, reply] of Object.entries(b)) {
      if (t.includes(trigger)) {
        await ctx.reply(reply)
        return false // do not block other hooks/commands
      }
    }
  }
  return false
}

module.exports = {
  hooks: [auto],
  commands: [
    add('filter', 'chat', 'Auto-reply in this chat: filter hi:hello'),
    add('gfilter', 'groups', 'Auto-reply in all groups'),
    add('pfilter', 'private', 'Auto-reply in all private chats'),
    del('stop', 'chat', 'Remove a filter of this chat'),
    del('gstop', 'groups', 'Remove a group filter'),
    del('pstop', 'private', 'Remove a private filter'),
  ],
}
