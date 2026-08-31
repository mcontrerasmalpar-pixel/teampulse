# TeamPulse in Cursor

Use the published bin. Do not point Cursor at `src/mcp-server.js`.

## mcp.json

Project or user MCP config:

```json
{
  "mcpServers": {
    "teampulse": {
      "command": "npx",
      "args": ["-y", "teampulse-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

Equivalent:

```json
{
  "mcpServers": {
    "teampulse": {
      "command": "npx",
      "args": ["-y", "teampulse", "mcp"]
    }
  }
}
```

## Tools

- `analyze_meeting` — writes cache/memory. Required: `transcript`. Optional: `format`, `provider`, `fallbackProvider`, `useCache`, `timeoutMs`.
- `get_meeting_history` — `readOnlyHint: true`. Optional: `limit`.

Offline / CI: `"provider": "fixture"`.
