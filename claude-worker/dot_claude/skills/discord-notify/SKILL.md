---
name: discord-notify
description: Send Discord webhook notifications that always mention the configured user and optionally attach a file. Use when you need to notify via Discord from this project.
---

# Discord Notify Skill

Use the CLI at `scripts/discord-notify.py`.

## Requirements

Expect these environment variables to already be set:

- `DISCORD_USER_ID`
- `DISCORD_WEBHOOK_URL`

The script will:

- Prefix every message with `<@DISCORD_USER_ID>`
- Use the current machine hostname as the Discord `username`
- Attach a file when a second argument is provided

## Usage

```bash
./scripts/discord-notify.py [message] [optional file]
```

Examples:

```bash
./scripts/discord-notify.py "Build finished"
```

```bash
./scripts/discord-notify.py "Build finished" video.mp4
```

## Notes

- Do not manually add the Discord mention to the message; the script does it automatically.