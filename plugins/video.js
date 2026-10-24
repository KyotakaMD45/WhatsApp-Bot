const { getMedia } = require('../lib/media')
const { run, withTmp } = require('../lib/shell')

const vid = (cmd, desc, build, send = 'video') => ({
  cmd,
  desc,
  category: 'video',
  run: async (ctx) => {
    const media = await getMedia(ctx, ['videoMessage'])
    if (!media) return ctx.reply(`Reply to a video with ${ctx.prefix}${cmd}`)
    const ext = send === 'audio' ? '.mp3' : '.mp4'
    const out = await withTmp('.mp4', ext, media.buffer, (i, o) => run('ffmpeg', ['-y', '-i', i, ...build(ctx), o], 300000))
    await ctx.sock.sendMessage(ctx.jid, send === 'audio' ? { audio: out, mimetype: 'audio/mpeg' } : { video: out }, { quoted: ctx.m })
  },
})

const ROT = { left: 'transpose=2', right: 'transpose=1', flip: 'vflip', mirror: 'hflip' }

module.exports = {
  commands: [
    vid('compress', 'Shrink a video', () => ['-vcodec', 'libx264', '-crf', '32', '-preset', 'fast', '-acodec', 'aac', '-b:a', '96k']),
    vid('crop', 'Crop to a square (or crop W:H)', (c) => ['-vf', c.args ? `crop=${c.args}` : "crop='min(iw,ih)':'min(iw,ih)'", '-c:a', 'copy']),
    vid('mp3', 'Video to audio', () => ['-vn'], 'audio'),
    vid('reverse', 'Play a video backwards', () => ['-vf', 'reverse', '-af', 'areverse']),
    vid('rotate', 'Rotate: left | right | flip | mirror', (c) => ['-vf', ROT[c.args.trim().toLowerCase()] || ROT.right, '-c:a', 'copy']),
    vid('trim', 'Trim: trim 00:05 00:15', (c) => {
      const [a = '0', b] = c.args.split(/\s+/)
      return ['-ss', a, ...(b ? ['-to', b] : [])]
    }),
  ],
}
