const assert = require('node:assert/strict')
const test = require('node:test')
const { createTranslator } = require('../lib/i18n')

test('translator uses the selected language and interpolates values', () => {
  const t = createTranslator('fr')

  assert.equal(t('menu.commands'), 'Commandes')
  assert.equal(t('error.commandFailed', { message: 'test' }), 'Erreur : test')
})

test('translator falls back to English and then to the key', () => {
  const t = createTranslator('fr')

  assert.equal(t('menu.mode'), 'Mode')
  assert.equal(t('missing.key'), 'missing.key')
})
