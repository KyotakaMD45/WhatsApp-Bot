# External plugins

Put optional locally-installed plugin modules in this directory. Each module
may export `commands`, `hooks`, and `events`, matching the built-in plugin
format used in `plugins/`.

Plugins execute as part of the bot process and have access to its permissions.
Only install code from sources you trust.
