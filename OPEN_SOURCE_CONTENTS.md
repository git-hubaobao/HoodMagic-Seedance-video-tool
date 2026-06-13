# Open Source Contents

This release directory is generated from the development workspace by scripts/sync-open-source.js.

Included:

- apps/video-tool source, Electron configuration, renderer public icons, and packaging helper script
- packages/video-core source and tests
- packages/provider-adapters source and tests
- packages/storage source
- pnpm workspace files and lockfile
- README, LICENSE, .gitignore, .env.example, config.example.json
- GitHub issue and pull request templates

Excluded:

- node_modules
- Electron build output: apps/video-tool/out and apps/video-tool/release
- tmp screenshots, logs, and PDF extraction cache
- local user data, app data, databases, JSON stores, task history, downloads, generated videos, and asset caches
- real API keys, object storage credentials, bucket configuration, endpoint configuration, and tokens
- installers, archives, private key files, certificates, and large media assets

