# TeamPulse

> **Terminal-first meeting intelligence** — Gemini · Claude · GPT-4

Paste a transcript → extract decisions, tasks, risks, owners, and drift patterns — instantly, from your terminal. Works with any AI provider.

```
teampulse analyze sprint-review.txt
teampulse analyze sprint-review.txt --provider claude
teampulse analyze sprint-review.txt --provider openai --model gpt-4o-mini
teampulse drift --last 2
teampulse watchdog --provider claude
```

---

## Install

### macOS / Linux

```bash
git clone https://github.com/mcontrerasmalpar-pixel/teampulse.git
cd teampulse
npm install
cp .env.example .env
```

Edit `.env` and add your API key, then run the setup wizard:

```bash
npm start -- init
```

Or install globally as a CLI command:

```bash
npm install -g .
teampulse init
```

### Windows (PowerShell)

```powershell
git clone https://github.com/mcontrerasmalpar-pixel/teampulse.git
cd teampulse
npm install
copy .env.example .env
npm start -- init
```

> **Node.js 18+** required. Download at [nodejs.org](https://nodejs.org).

---

## Providers & API Keys

| Provider | Flag | Key variable | Free tier? | Get key |
|----------|------|-------------|------------|--------|
| **Gemini** | `--provider gemini` | `GEMINI_API_KEY` | ✅ Yes | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| **Claude** | `--provider claude` | `ANTHROPIC_API_KEY` | ❌ Paid | [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | `--provider openai` | `OPENAI_API_KEY` | ❌ Paid | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

Add only the keys you need to `.env`. TeamPulse defaults to Gemini.

**Available models:**

| Provider | Models |
|----------|--------|
| Gemini | `gemini-2.0-flash` (default) · `gemini-1.5-pro` · `gemini-1.5-flash` |
| Claude | `claude-3-5-sonnet-20241022` (default) · `claude-3-haiku-20240307` · `claude-3-opus-20240229` |
| OpenAI | `gpt-4o` (default) · `gpt-4o-mini` · `gpt-4-turbo` |

```bash
# Override provider and model on any command
teampulse analyze meeting.txt --provider claude --model claude-3-haiku-20240307
teampulse watchdog --provider openai --model gpt-4o-mini
```

---

## Commands

### `analyze <file>`

Extract structured intelligence from a meeting transcript.

```bash
teampulse analyze sprint-review.txt
teampulse analyze sprint-review.txt --provider claude --skill developer
teampulse analyze sprint-review.txt --format markdown --output report.md
teampulse analyze sprint-review.txt --format json --output report.json
teampulse analyze --watch ./transcripts/
```

| Flag | Values | Default |
|------|--------|---------|
| `--provider` | `gemini` · `claude` · `openai` | `gemini` |
| `--model` | see model table above | provider default |
| `--skill` | `product-manager` · `developer` · `founder` · `marketing` | `product-manager` |
| `--format` | `plain` · `json` · `markdown` | `plain` |
| `--output` | `<filename>` | stdout |
| `--filter` | `decision` · `task` · `risk` | — |
| `--watch [dir]` | folder path | current dir |

---

### `batch <dir>`

Analyze all `.txt` transcripts in a directory in one pass.

```bash
teampulse batch ./meetings
teampulse batch ./meetings --since 2026-05-01
teampulse batch ./meetings --provider claude --filter task --title "Sprint 12"
```

| Flag | Description |
|------|-------------|
| `--provider` / `--model` | AI provider and model override |
| `--since <date>` | Only files modified after `YYYY-MM-DD` |
| `--filter <type>` | Show only `decision` · `task` · `risk` |
| `--title <label>` | Label the batch report |

---

### `chat`

Interactive REPL for conversational analysis over your meeting history.

```bash
teampulse chat
teampulse chat --provider claude
teampulse chat --meeting <meeting-id>
```

**In-session commands:**

| Command | Action |
|---------|--------|
| `/meetings` | List all meetings in memory |
| `/use <id>` | Focus on a specific meeting |
| `/clear` | Reset conversation history |
| `/help` | Show all commands |
| `/exit` | Exit |

**Example prompts:**
```
› what decisions were made last sprint?
› show tasks without owners
› summarize all risks across meetings
› who has the most open action items?
```

---

### `drift <id-A> <id-B>`

Compare two meetings side-by-side and score decision drift.

```bash
teampulse drift <meeting-id-A> <meeting-id-B>
teampulse drift --last 2
teampulse drift --last 3 --provider claude
```

| Flag | Description |
|------|-------------|
| `--last <n>` | Auto-compare the last `n` meetings |
| `--provider` / `--model` | AI provider override |

**Output:**
- Overall Drift Score (0–100)
- Per-item classification: `resolved` · `regressed` · `recurring` · `abandoned` · `new`
- Recurring blockers with severity
- Ownership follow-through tracker

---

### `watchdog`

Scan your full meeting history for systemic issues.

```bash
teampulse watchdog
teampulse watchdog --team engineering
teampulse watchdog --provider openai
```

| Flag | Description |
|------|-------------|
| `--team <name>` | Filter to a specific team or participant |
| `--provider` / `--model` | AI provider override |

**Output:**
- Team Health Score (0–100)
- Unresolved risks ranked by severity
- Recurring ownerless task patterns
- Overloaded participants workload table
- Topics that recur without resolution

> Scans up to 20 most recent meetings.

---

### `history`

```bash
teampulse history
teampulse history --limit 20
```

---

### `watch <dir>`

Monitor a folder and auto-analyze any new `.txt` transcript added.

```bash
teampulse watch ./meetings
teampulse watch ./meetings --provider claude
```

---

### `init`

Guided setup wizard. Configures API keys (Gemini, Claude, OpenAI), default provider, default skill, and team name.

```bash
teampulse init
```

---

## How to get transcripts

**Google Meet:**
1. Enable transcription before/during the meeting
2. After the meeting, transcript saves to Google Drive automatically
3. Open in Drive → **File → Download → Plain text (.txt)**
4. Run: `teampulse analyze your-transcript.txt`

**Zoom:**
- Enable transcription in Zoom settings → transcripts save as `.vtt` or `.txt` in your Recordings folder

**Teams:**
- Open meeting chat → **…** → **Download transcript** → save as `.txt`

---

## Architecture

```
src/
├── index.js              # CLI router (Commander.js)
├── commands/
│   ├── analyze.js        # Single transcript analysis
│   ├── batch.js          # Bulk directory processing
│   ├── chat.js           # REPL / conversational mode
│   ├── drift.js          # Meeting-to-meeting comparison
│   ├── history.js        # Meeting history browser
│   ├── init.js           # Setup wizard (multi-provider)
│   ├── watch.js          # Directory file watcher
│   └── watchdog.js       # Systemic risk monitor
├── services/
│   ├── provider.js       # Multi-provider router (Gemini · Claude · OpenAI)
│   └── gemini.js         # Legacy Gemini client (kept for reference)
└── utils/
    ├── ui.js             # Terminal rendering (chalk, boxen, cli-table3)
    └── memory.js         # Persistence (lowdb → ~/.teampulse/memory.json)
```

**Key design patterns:**
- All commands route through `provider.js` — swap provider with one flag
- `callProvider(provider, model, prompt, opts)` is the single call surface
- `jsonMode: true` enables structured JSON output on Gemini and OpenAI
- Command + REPL interaction surfaces share the same memory layer
- All data lives locally in `~/.teampulse/memory.json` — nothing external

---

## Data & Privacy

All data is stored locally at `~/.teampulse/memory.json`.  
The only outbound calls are to the AI provider APIs you configure (Gemini, Claude, or OpenAI).  
No data is sent to TeamPulse servers.
