const fs = require('fs')
const os = require('os')
const path = require('path')
const config = require('../config')
const { run } = require('../lib/shell')

// Requires yt-dlp and ffmpeg on the server.
async function download(query, audio) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-'))
  try {
    const target = /^https?:\/\//i.test(query) ? query : `ytsearch1:${query}`
    const args = ['--no-playlist', '--max-filesize', `${config.MAX_UPLOAD}M`, '-o', path.join(dir, '%(title).80s.%(ext)s')]
    if (config.YT_COOKIE && fs.existsSync(config.YT_COOKIE)) args.push('--cookies', config.YT_COOKIE)
    args.push(...(audio ? ['-x', '--audio-format', 'mp3'] : ['-f', 'best[ext=mp4][height<=720]/best[height<=720]/best']))
    await run('yt-dlp', [...args, target], 300000)
    const file = fs.readdirSync(dir)[0]
    if (!file) throw new Error('Nothing downloaded (file too large or blocked).')
    return { buffer: fs.readFileSync(path.join(dir, file)), title: path.parse(file).name }
  } finally {
    fs.rm(dir, { recursive: true, force: true }, () => {})
  }
}

const dl = (cmd, alias, audio, desc) => ({
  cmd,
  alias,
  desc,
  category: 'download',
  run: async (ctx) => {
    if (!ctx.args) return ctx.reply(`Usage: ${ctx.prefix}${cmd} <link or search>`)
    await ctx.reply('Downloading...')
    const { buffer, title } = await download(ctx.args, audio)
    await ctx.sock.sendMessage(
      ctx.jid,
      audio ? { audio: buffer, mimetype: 'audio/mpeg' } : { video: buffer, caption: title },
      { quoted: ctx.m }
    )
  },
})

module.exports = {
  commands: [
    dl('play', ['song'], true, 'Search YouTube and send the audio'),
    dl('ytmp3', ['yta'], true, 'YouTube link/search to audio'),
    dl('ytmp4', ['ytv', 'video'], false, 'YouTube link/search to video'),
  ],
}
