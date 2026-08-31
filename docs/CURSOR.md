# Integrar TeamPulse con Cursor

Cursor lee MCP desde:

| Alcance | Archivo |
| --- | --- |
| Este repo | `.cursor/mcp.json` |
| Todos tus proyectos | `~/.cursor/mcp.json` |

No apuntes a `src/mcp-server.js` con una ruta absoluta. Usa el bin publicado.

## 1. Requisitos

- Node.js 18+
- Cursor (Settings → Tools & MCP)
- Al menos una API key **o** Ollama local

Si `teampulse@1.1.0` aún no está en npm, publica primero:

```bash
npm publish
```

## 2. Proyecto (recomendado)

Este repo ya trae `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "teampulse": {
      "command": "npx",
      "args": ["-y", "teampulse-mcp"],
      "env": {
        "GEMINI_API_KEY": "${env:GEMINI_API_KEY}"
      }
    }
  }
}
```

`${env:GEMINI_API_KEY}` toma la variable de tu shell / entorno. No subas la key al git.

## 3. Global (todos los workspaces)

```bash
mkdir -p ~/.cursor
```

En `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "teampulse": {
      "command": "npx",
      "args": ["-y", "teampulse-mcp"],
      "env": {
        "GEMINI_API_KEY": "tu-api-key"
      }
    }
  }
}
```

Equivalente:

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

## 4. Desde Cursor UI

1. Abre **Cursor Settings → Tools & MCP**
2. **New MCP Server** (abre `mcp.json`)
3. Pega el bloque `teampulse` de arriba
4. Guarda y **reinicia Cursor** (quit, no solo reload)
5. En Tools & MCP, `teampulse` debe aparecer con tools habilitadas

## 5. Comprobar

En Agent chat:

- “Usa get_meeting_history con limit 5”
- “Analiza esta transcripción con analyze_meeting y provider fixture: TASK: Write tests | owner=maria | priority=high”

Tools:

- `analyze_meeting` — escribe cache/memoria. Params: `transcript` (requerido), `format`, `provider`, `fallbackProvider`, `useCache`, `timeoutMs`
- `get_meeting_history` — `readOnlyHint: true`. Param: `limit`

Offline: `provider: "fixture"`.

## 6. Solo clone local (si npx aún no resuelve 1.1.0)

```json
{
  "mcpServers": {
    "teampulse": {
      "command": "node",
      "args": ["${workspaceFolder}/src/mcp-server.js"],
      "env": {
        "GEMINI_API_KEY": "${env:GEMINI_API_KEY}"
      }
    }
  }
}
```

Vuelve a `npx -y teampulse-mcp` en cuanto 1.1.0 esté publicado.
