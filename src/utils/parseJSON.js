// Strips markdown code fences and extracts the first valid JSON object/array.
// Providers sometimes wrap their JSON in ```json ... ``` blocks even when
// asked not to, and sometimes include trailing prose after the JSON.
export function parseJSON(raw, context = 'provider') {
  if (!raw || typeof raw !== 'string') {
    throw new Error(`${context} returned an empty response.`);
  }

  // 1. Direct parse (happy path — most providers obey jsonMode)
  try { return JSON.parse(raw); } catch {}

  // 2. Strip markdown code fences: ```json\n...\n``` or ```\n...\n```
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // 3. Grab the outermost JSON object (greedy — handles trailing text)
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }

  // 4. Grab the outermost JSON array
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {}
  }

  throw new Error(`${context} returned invalid JSON. Check your API key and transcript format.`);
}
