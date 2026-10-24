const english = require('../lang/en')
const french = require('../lang/fr')

const catalogs = { en: english, fr: french }

function createTranslator(language = 'en') {
  const messages = catalogs[language] || catalogs.en

  return (key, values = {}) => {
    const template = messages[key] || catalogs.en[key] || key
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
    )
  }
}

module.exports = { createTranslator }
