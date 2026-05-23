# TeamPulse

> CLI meeting intelligence. Drop in a transcript, get decisions, tasks, and risks out — cloud or fully local.

TeamPulse reads your Google Meet transcripts and pulls out what actually matters: who decided what, what needs doing, and what's blocking the team. It runs in your terminal, works with five AI providers, and never requires a cloud account if you don't want one.

## What it does

- Extracts **decisions**, **tasks**, **risks**, and **blockers** from meeting transcripts
- Assigns owners and confidence scores automatically
- Tracks **drift** — recurring topics and blockers across meetings
- Supports `--watch` mode for live folder monitoring
- Runs **batch analysis** across many files at once
- Works with **Gemini, Claude, GPT-4, Mistral, and Ollama** (fully local)

## Quick start

```bash
git clone https://github.com/mcontrerasmalpar-pixel/teampulse.git
cd teampulse && npm install
cp .env.example .env   # add your API key
npm link
teampulse analyze data/sample.txt
```

For fully local analysis (no API key needed):

```bash
ollama pull mistral
teampulse analyze data/sample.txt --provider ollama --model mistral
```

## Providers

| Provider | Flag | Key needed |
|---|---|---|
| Google Gemini | `--provider gemini` | `GEMINI_API_KEY` |
| Anthropic Claude | `--provider claude` | `ANTHROPIC_API_KEY` |
| OpenAI GPT-4 | `--provider openai` | `OPENAI_API_KEY` |
| Mistral AI | `--provider mistral` | `MISTRAL_API_KEY` |
| Ollama (local) | `--provider ollama` | none |

## CLI reference

```bash
# Analyze a single file
teampulse analyze meeting.txt

# Use a specific provider
teampulse analyze meeting.txt --provider claude

# Run fully offline with Ollama
teampulse analyze meeting.txt --provider ollama --model llama3

# Watch a folder for new transcripts
teampulse analyze --watch ./meetings/

# Batch process with date filter
teampulse batch ./meetings/ --since 2026-05-01

# Filter by insight type
teampulse batch ./meetings/ --filter risk
```

## Installation

Requires Node.js 18+. See the [landing page](https://mcontrerasmalpar-pixel.github.io/teampulse/) for platform-specific instructions.

## License

MIT
