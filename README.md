# WhatsApp Bot

Lightweight WhatsApp bot built with Node.js and Baileys.

## Project structure

```text
.
├── .github/
│   └── ISSUE_TEMPLATE/
├── eplugins/          # Optional, locally-installed plugins
├── lang/              # Language packs
├── lib/               # Bot services and shared helpers
├── media/             # Images, audio, and other static assets
├── plugins/           # Bot commands, events, and hooks
├── config.env.example # Example environment configuration
├── config.json.example # Legacy JSON configuration example
├── app.json           # Heroku deployment manifest
├── config.js          # Configuration loader
├── index.js           # Application entry point
└── package.json       # Dependencies and npm scripts
```

## Setup

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `config.env.example` to `config.env` and configure the login settings.
4. Run `npm start`.

Keep `config.env` and the `session/` directory private; they contain credentials
that can grant access to the WhatsApp account.

`config.env` is the recommended configuration and takes precedence. The older
JSON layout can be copied from `config.json.example` to `config.json`; the loader
uses its session IDs, prefixes, and settings that have equivalents in this bot
as fallbacks. Some settings shown in the legacy example (such as `FORCE_LOGOUT`,
`VPS`, `STICKER_PACKNAME`, `GPT`/`MODEL`, `PERSONAL_MESSAGE`, `DELETE_TYPE`,
and `LIST_TYPE`) belong to features this version does not implement and are
ignored.
`app.json` is the Heroku deployment manifest.

## Languages and plugins

Set `BOT_LANG` to `en` or `fr` to choose the language for the translated menu
and core command errors. English is the default; other plugin replies are not
translated yet.

Built-in plugins belong in `plugins/`. Optional local plugins can be added to
`eplugins/`; they run with the same permissions as the bot, so only use code
you trust.

## Multiple WhatsApp accounts

The existing `PAIR_NUMBER` and `SESSION_ID` settings continue to work for one
account. For several accounts, set `PAIR_NUMBERS` to comma-separated phone
numbers and/or `SESSION_IDS` to comma-separated base64 `creds.json` values.
The first account keeps using `session/`; additional accounts use
`session-1/`, `session-2/`, and so on. In the API, `session` is the zero-based
account index (for example, set `"session":"1"` in a `/api/send` request).
`GET /api/sessions` reports their connection status, and incoming webhook
payloads include their session index.
