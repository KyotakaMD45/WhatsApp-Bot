// Tiny JSON store: no native modules, nothing to compile.
const fs = require('fs')
const path = require('path')
const config = require('../config')

const file = path.join(__dirname, '..', 'data', 'db.json')
let data = { settings: {}, groups: {}, warns: {}, kv: {} }
try {
  data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }
} catch {}

let timer
const save = () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
  }, 300)
}

const group = (jid) => {
  if (!data.groups[jid]) {
    data.groups[jid] = { antilink: 'off', antispam: 'off', antiword: 'off', antibot: 'off', words: [], welcome: false, goodbye: false }
  }
  return data.groups[jid]
}

// generic persistent store: db.kv('name', defaultValue) returns a live object, call db.save() after changes
const kv = (name, def) => {
  data.kv = data.kv || {}
  if (data.kv[name] === undefined) data.kv[name] = def
  return data.kv[name]
}

module.exports = {
  save,
  kv,
  group,
  mode: () => data.settings.mode || config.MODE,
  setMode: (m) => {
    data.settings.mode = m
    save()
  },
  addWarn: (g, u) => {
    const k = `${g}:${u}`
    data.warns[k] = (data.warns[k] || 0) + 1
    save()
    return data.warns[k]
  },
  getWarn: (g, u) => data.warns[`${g}:${u}`] || 0,
  resetWarn: (g, u) => {
    delete data.warns[`${g}:${u}`]
    save()
  },
}
