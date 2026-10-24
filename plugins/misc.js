const config = require('../config')
const db = require('../lib/db')
const { getContext, num } = require('../lib/utils')

const fmtUptime = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${Math.floor(s % 60)}s`
const afk = () => db.kv('afk', { on: false, reason: '', since: 0, notified: {} })

async function afkHook(ctx) {
  const a = afk()
  if (!a.on) return false
  const c = getContext(ctx.m)
  const mentioned = (c?.mentionedJid || []).some((j) => num(j) === num(ctx.meJid))
  if (ctx.isGroup && !mentioned) return false
  if (Date.now() - (a.notified[ctx.sender] || 0) < 3600000) return false // once per hour per person
  a.notified[ctx.sender] = Date.now()
  await ctx.reply(`I'm away since ${fmtUptime((Date.now() - a.since) / 1000)} ago.\nReason: ${a.reason || '-'}`)
  return false
}

const tasks = () => db.kv('tasks', [])
const owner = (o) => ({ category: 'misc', ...o })

module.exports = {
  hooks: [afkHook],
  commands: [
    owner({
      cmd: 'alive',
      desc: 'Bot status',
      run: (ctx) => ctx.reply(`*${config.BOT_NAME}* is alive ✅\nUptime: ${fmtUptime(process.uptime())}\nMode: ${db.mode()}`),
    }),
    owner({
      cmd: 'calc',
      desc: 'Calculator: calc 2*(3+4)',
      run: async (ctx) => {
        const e = ctx.args.replace(/,/g, '.').replace(/\^/g, '**')
        if (!e || !/^[\d+\-*/().%\s]+$/.test(e)) return ctx.reply(`Usage: ${ctx.prefix}calc 2*(3+4)`)
        const r = Function(`"use strict"; return (${e})`)()
        await ctx.reply(`${ctx.args} = ${r}`)
      },
    }),
    owner({
      cmd: 'tts',
      desc: 'Text to speech: tts fr bonjour',
      run: async (ctx) => {
        const m = ctx.args.match(/^([a-z]{2})\s+(.+)$/is)
        const lang = m ? m[1].toLowerCase() : 'en'
        const text = (m ? m[2] : ctx.args).slice(0, 200)
        if (!text) return ctx.reply(`Usage: ${ctx.prefix}tts fr bonjour (max 200 chars)`)
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!r.ok) throw new Error('TTS service error ' + r.status)
        await ctx.sock.sendMessage(ctx.jid, { audio: Buffer.from(await r.arrayBuffer()), mimetype: 'audio/mpeg', ptt: true }, { quoted: ctx.m })
      },
    }),
    owner({
      cmd: 'weather',
      desc: 'Weather: weather Abidjan',
      run: async (ctx) => {
        if (!ctx.args) return ctx.reply(`Usage: ${ctx.prefix}weather <city>`)
        const r = await fetch(`https://wttr.in/${encodeURIComponent(ctx.args)}?format=%l:+%c+%t+(feels+%f),+humidity+%h,+wind+%w`)
        await ctx.reply(r.ok ? (await r.text()).trim() : 'City not found.')
      },
    }),
    owner({
      cmd: 'time',
      desc: 'Time in a timezone: time Africa/Abidjan',
      run: async (ctx) => {
        const tz = ctx.args.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
        try {
          await ctx.reply(`${tz}: ${new Date().toLocaleString('en-GB', { timeZone: tz })}`)
        } catch {
          await ctx.reply('Unknown timezone. Example: Africa/Abidjan, Europe/Paris')
        }
      },
    }),
    owner({
      cmd: 'afk',
      desc: 'Away mode: afk <reason> / afk off',
      owner: true,
      run: async (ctx) => {
        const a = afk()
        if (ctx.args.trim().toLowerCase() === 'off') {
          a.on = false
          db.save()
          return ctx.reply('AFK disabled.')
        }
        Object.assign(a, { on: true, reason: ctx.args.trim(), since: Date.now(), notified: {} })
        db.save()
        await ctx.reply('AFK enabled.')
      },
    }),
    owner({
      cmd: 'reminder',
      desc: 'Reminder: reminder 10m call mom (lost on restart)',
      owner: true,
      run: async (ctx) => {
        const m = ctx.args.match(/^(\d+)\s*([smhd])\s+(.+)$/is)
        if (!m) return ctx.reply(`Usage: ${ctx.prefix}reminder 10m call mom (s/m/h/d)`)
        const ms = Number(m[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()]
        if (ms > 2 ** 31 - 1) return ctx.reply('Too far in the future.')
        setTimeout(() => ctx.sock.sendMessage(ctx.meJid, { text: '⏰ Reminder: ' + m[3] }).catch(() => {}), ms)
        await ctx.reply(`I will remind you in ${m[1]}${m[2]}.`)
      },
    }),
    owner({
      cmd: 'task',
      desc: 'To-do list: task add x | task done 2 | task',
      owner: true,
      run: async (ctx) => {
        const list = tasks()
        const [sub, ...rest] = ctx.args.trim().split(/\s+/)
        const arg = rest.join(' ')
        if (sub === 'add' && arg) list.push({ text: arg, done: false })
        else if (sub === 'done' && list[Number(arg) - 1]) list[Number(arg) - 1].done = true
        else if (sub === 'del' && list[Number(arg) - 1]) list.splice(Number(arg) - 1, 1)
        else if (sub === 'clear') list.length = 0
        db.save()
        await ctx.reply(list.map((t, i) => `${i + 1}. ${t.done ? '✅' : '⬜'} ${t.text}`).join('\n') || `No tasks. Add: ${ctx.prefix}task add buy bread`)
      },
    }),
  ],
}
