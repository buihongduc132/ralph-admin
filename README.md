# ralph-admin

PM2-integrated ralph fleet manager.

## Commands

| Command | Description |
|---------|-------------|
| `list` | Show all ralph loops with status, iteration, model, progress |
| `status <name>` | Detailed status of one loop |
| `bootstrap <name>` | Init everything WITHOUT starting |
| `start <name>` | Start ralph loop via PM2 |
| `pause <name>` | Pause at PM2 level |
| `resume <name>` | Resume paused loop |
| `stop <name>` | Full stop + delete from PM2 |
| `restart <name>` | Hard restart |
| `doctor` | Fleet-wide health check |
| `inventory <name>` | Show task progress |
| `inject-header <name>` | Inject working-dir header into _GOAL |

## Install

```bash
bun install
```

## Run

```bash
bun run src/cli.ts --help
```

## Build

```bash
bun run build
./bin/ralph-admin --help
```

## Test

```bash
bun test
```
