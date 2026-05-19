# TeamPulse CLI

Terminal-first meeting intelligence agent powered by Google Gemini.

Paste a Google Meet transcript → get decisions, tasks, risks, and owners — instantly.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Set your Gemini API key (get one free at aistudio.google.com/app/apikey)
echo "GEMINI_API_KEY=your-key-here" > .env

# 3. Analyze a meeting transcript
node src/index.js analyze data/sample-meeting.txt

# 4. Chat over your meeting history
node src/index.js chat
```

## How to get Google Meet transcripts

1. In Google Meet, enable transcription before or during your meeting
2. After the meeting, the transcript is saved automatically to Google Drive
3. Open it in Drive → File → Download → Plain text (.txt)
4. Run: `teampulse analyze your-transcript.txt`

---

## Commands

### `analyze <file>`

Analyze a meeting transcript and extract structured intelligence.

```bash
node src/index.js analyze sprint-review.txt
node src/index.js analyze sprint-review.txt --skill developer
node src/index.js analyze sprint-review.txt --format json --output report.json
node src/index.js analyze sprint-review.txt --format markdown
```

**Options:**
- `--skill` — Role perspective: `product-manager` | `developer` | `founder` | `marketing` (default: `product-manager`)
- `--format` — Output format: `plain` | `json` | `markdown` (default: `plain`)
- `--output` — Save output to file

### `chat`

Interactive REPL for conversational analysis over your meeting history.

```bash
node src/index.js chat
node src/index.js chat --meeting <meeting-id>
```

**Chat commands:**
- `/meetings` — List meetings in memory
- `/use <id>` — Focus on a specific meeting
- `/clear` — Reset conversation history
- `/help` — Show all commands
- `/exit` — Exit

**Example prompts:**
```
> what decisions were made last sprint?
> show tasks without owners
> summarize the main risks across all meetings
> who has the most open action items?
```

### `history`

List all analyzed meetings stored in local memory.

```bash
node src/index.js history
node src/index.js history --limit 20
```

### `init`

Guided setup wizard. Configures your default skill, output format, and API key.

```bash
node src/index.js init
```

---

## Architecture

Inspired by [Gemini CLI](https://github.com/google-gemini/gemini-cli) and [OpenCode](https://opencode.ai):

```
src/
├── index.js              # CLI router (Commander.js)
├── commands/
│   ├── analyze.js        # analyze command
│   ├── chat.js           # REPL/chat mode
│   ├── init.js           # setup wizard
│   └── history.js        # meeting history browser
├── services/
│   └── gemini.js         # Gemini API + structured outputs
└── utils/
    ├── ui.js             # terminal rendering (chalk, boxen, cli-table3)
    └── memory.js         # persistence layer (lowdb → ~/.teampulse/memory.json)
```

**Key patterns borrowed from Gemini CLI / OpenCode:**
- Command mode + REPL/chat mode (two interaction surfaces)
- Full conversation history passed on every turn (stateless Gemini, stateful client)
- Structured JSON outputs via `responseMimeType: 'application/json'`
- Persistent local storage (`~/.teampulse/memory.json`)
- Spinner + confirmation before any write action

---

## Data storage

All data is stored locally at `~/.teampulse/memory.json`. Nothing is sent anywhere except to the Gemini API for analysis.
