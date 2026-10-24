const { getMedia } = require('../lib/media')
const { run, withTmp } = require('../lib/shell')

// Audio effects, applied with ffmpeg to an audio/video message (or the replied one)
const FX = {
  bass: 'equalizer=f=54:width_type=o:width=2:g=20',
  blown: 'acrusher=.1:1:64:0:log',
  deep: 'atempo=4/4,asetrate=44500*2/3',
  earrape: 'volume=12',
  fast: 'atempo=1.63,asetrate=44100',
  fat: 'atempo=1.6,asetrate=22100',
  low: 'asetrate=44100*0.75,aresample=44100',
  nightcore: 'atempo=1.06,asetrate=44100*1.25',
  robot: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75",
  slow: 'atempo=0.7,asetrate=44100',
  treble: 'treble=g=15',
  tupai: 'atempo=0.5,asetrate=65100',
}

const KINDS = ['audioMessage', 'videoMessage']

const effect = (cmd, filter) => ({
  cmd,
  desc: `Audio effect: ${cmd}`,
  category: 'audio',
  run: async (ctx) => {
    const media = await getMedia(ctx, KINDS)
    if (!media) return ctx.reply(`Reply to an audio with ${ctx.prefix}${cmd}`)
    const out = await withTmp('.bin', '.mp3', media.buffer, (i, o) => run('ffmpeg', ['-y', '-i', i, '-vn', '-af', filter, o]))
    await ctx.sock.sendMessage(ctx.jid, { audio: out, mimetype: 'audio/mpeg' }, { quoted: ctx.m })
  },
})

module.exports = {
  commands: [
    ...Object.entries(FX).map(([c, f]) => effect(c, f)),
    {
      cmd: 'pitch',
      desc: 'Change pitch: pitch 1.3 (reply to audio)',
      category: 'audio',
      run: async (ctx) => {
        const n = Number(ctx.args) || 1.3
        if (n < 0.3 || n > 3) return ctx.reply('Use a value between 0.3 and 3')
        const media = await getMedia(ctx, KINDS)
        if (!media) return ctx.reply('Reply to an audio message.')
        const out = await withTmp('.bin', '.mp3', media.buffer, (i, o) =>
          run('ffmpeg', ['-y', '-i', i, '-vn', '-af', `asetrate=44100*${n},aresample=44100`, o])
        )
        await ctx.sock.sendMessage(ctx.jid, { audio: out, mimetype: 'audio/mpeg' }, { quoted: ctx.m })
      },
    },
    {
      cmd: 'cut',
      desc: 'Cut audio: cut 00:10 00:30 (start end)',
      category: 'audio',
      run: async (ctx) => {
        const [a, b] = ctx.args.split(/\s+/)
        if (!a || !b) return ctx.reply(`Usage: ${ctx.prefix}cut 00:10 00:30 (reply to audio)`)
        const media = await getMedia(ctx, KINDS)
        if (!media) return ctx.reply('Reply to an audio message.')
        const out = await withTmp('.bin', '.mp3', media.buffer, (i, o) => run('ffmpeg', ['-y', '-i', i, '-ss', a, '-to', b, '-vn', o]))
        await ctx.sock.sendMessage(ctx.jid, { audio: out, mimetype: 'audio/mpeg' }, { quoted: ctx.m })
      },
    },
    {
      cmd: 'black',
      desc: 'Audio to video with a black screen',
      category: 'audio',
      run: async (ctx) => {
        const media = await getMedia(ctx, KINDS)
        if (!media) return ctx.reply('Reply to an audio message.')
        const out = await withTmp('.bin', '.mp4', media.buffer, (i, o) =>
          run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=640x360', '-i', i, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', o])
        )
        await ctx.sock.sendMessage(ctx.jid, { video: out }, { quoted: ctx.m })
      },
    },
    {
      cmd: 'histo',
      desc: 'Audio to video with a waveform',
      category: 'audio',
      run: async (ctx) => {
        const media = await getMedia(ctx, KINDS)
        if (!media) return ctx.reply('Reply to an audio message.')
        const out = await withTmp('.bin', '.mp4', media.buffer, (i, o) =>
          run('ffmpeg', ['-y', '-i', i, '-filter_complex', 'showwaves=s=640x360:mode=cline:colors=white,format=yuv420p[v]', '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-c:a', 'aac', o])
        )
        await ctx.sock.sendMessage(ctx.jid, { video: out }, { quoted: ctx.m })
      },
    },
  ],
}
