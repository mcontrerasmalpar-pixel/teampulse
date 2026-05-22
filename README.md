# TeamPulse

> **Terminal-first meeting intelligence** — powered by Google Gemini.

Paste a transcript → extract decisions, tasks, risks, owners, and drift patterns — instantly, from your terminal.

```
teampulse analyze sprint-review.txt
teampulse drift --last 2
teampulse watchdog
```

---

## Install

```bash
git clone https://github.com/mcontrerasmalpar-pixel/teampulse.git
cd teampulse
npm install
echo "GEMINI_API_KEY=your-key-here" > .env
```

Get a free API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

---

## Commands

### `analyze <file>`

Extract structured intelligence from a single meeting transcript.

```bash
teampulse analyze sprint-review.txt
teampulse analyze sprint-review.txt --skill developer
teampulse analyze sprint-review.txt --format json --output report.json
teampulse analyze sprint-review.txt --format markdown
```

| Flag | Values | Default |
|------|--------|---------|
| `--skill` | `product-manager` · `developer` · `founder` · `marketing` | `product-manager` |
| `--format` | `plain` · `json` · `markdown` | `plain` |
| `--output` | `<filename>` | stdout |

---

### `batch <dir>`

Analyze all `.txt` transcripts in a directory in one pass. Outputs a consolidated summary of decisions, tasks, and risks across all files.

```bash
teampulse batch ./meetings
teampulse batch ./meetings --since 2026-05-01
teampulse batch ./meetings --filter task --title "Sprint 12"
```

| Flag | Description |
|------|-------------|
| `--since <date>` | Only process files modified after `YYYY-MM-DD` |
| `--filter <type>` | Show only `decision` · `task` · `risk` |
| `--title <label>` | Label the batch report |

---

### `chat`

Interactive REPL for conversational analysis over your meeting history. Full conversation context is maintained per session.

```bash
teampulse chat
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
> what decisions were made last sprint?
> show tasks without owners
> summarize all risks across meetings
> who has the most open action items?
```

---

### `drift <id-A> <id-B>`

Compare two meetings side-by-side. Detects which decisions were resolved, regressed, abandoned, or are recurring — and scores the delta.

```bash
teampulse drift <meeting-id-A> <meeting-id-B>
teampulse drift --last 2
```

| Flag | Description |
|------|-------------|
| `--last <n>` | Auto-compare the last `n` meetings (min 2) |

**Drift output includes:**
- Overall Drift Score (0–100)
- Per-item drift classification: `resolved` · `regressed` · `recurring` · `abandoned` · `new`
- Recurring blockers with severity and owner
- Ownership follow-through — who committed and didn't deliver

---

### `watchdog`

Scan your full meeting history for systemic patterns: unresolved risks, recurring topics, ownerless tasks, and workload imbalances.

```bash
teampulse watchdog
teampulse watchdog --team engineering
```

| Flag | Description |
|------|-------------|
| `--team <name>` | Filter scan to a specific team or participant group |

**Watchdog output includes:**
- Team Health Score (0–100)
- Unresolved risks ranked by severity
- Recurring ownerless task patterns
- Overloaded participants table
- Topics that appear across meetings without resolution

> Scans up to 20 most recent meetings to stay within model token limits.

---

### `history`

Browse all analyzed meetings stored in local memory.

```bash
teampulse history
teampulse history --limit 20
```

---

### `watch <dir>`

Monitor a directory for new transcript files. Auto-analyzes any `.txt` file added while the watcher is running.

```bash
teampulse watch ./meetings
teampulse watch ./meetings --filter task
```

Useful for teams that export Meet transcripts to a shared folder automatically.

---

### `init`

Guided setup wizard. Configures your default skill, output format, and API key.

```bash
teampulse init
```

---

## How to get Google Meet transcripts

1. In Google Meet, enable transcription before or during the meeting
2. After the meeting, the transcript is saved to Google Drive automatically
3. Open it in Drive → **File → Download → Plain text (.txt)**
4. Run: `teampulse analyze your-transcript.txt`

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
│   ├── init.js           # Setup wizard
│   ├── watch.js          # Directory file watcher
│   └── watchdog.js       # Systemic risk monitor
├── services/
│   └── gemini.js         # Gemini API + structured JSON outputs
└── utils/
    ├── ui.js             # Terminal rendering (chalk, boxen, cli-table3)
    └── memory.js         # Persistence layer (lowdb → ~/.teampulse/memory.json)
```

**Key design patterns:**
- Command mode + REPL mode (two interaction surfaces)
- Full conversation history passed on every turn — stateless model, stateful client
- Structured JSON outputs via `responseMimeType: 'application/json'`
- Local persistence only — all data lives in `~/.teampulse/memory.json`
- Spinner + confirmation before any write action

---

## Data & Privacy

All data is stored locally at `~/.teampulse/memory.json`.  
Nothing is persisted externally. The only outbound call is to the **Gemini API** for analysis.
