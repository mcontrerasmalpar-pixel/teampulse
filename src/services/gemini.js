import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_ID = 'gemini-2.0-flash';
const TIMEOUT_MS = 30_000;

let client = null;

function withTimeout(promise, ms = TIMEOUT_MS) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Gemini request timed out after ${ms / 1000}s. Check your connection or try again.`)), ms)
  );
  return Promise.race([promise, timer]);
}

function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY not set.\n  Add it to your .env file or run: export GEMINI_API_KEY=your-key\n  Get a key at: https://aistudio.google.com/app/apikey'
      );
    }
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

// ── Core analyze call - returns structured JSON ──────────────────────────────
export async function analyzeMeeting(transcript, skill = 'product-manager') {
  const model = getClient().getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    }
  });

  const skillContext = SKILL_PROMPTS[skill] || SKILL_PROMPTS['product-manager'];

  const prompt = `${skillContext}

You are analyzing a meeting transcript. Extract structured intelligence and return ONLY valid JSON matching this schema exactly:

{
  "title": "string - inferred meeting title",
  "summary": "string - 2-3 sentence executive summary",
  "sentiment": "positive | neutral | negative | mixed",
  "decisions": [
    {
      "title": "string",
      "context": "string - why this decision was made",
      "owner": "string or null",
      "status": "open | pending | blocked"
    }
  ],
  "tasks": [
    {
      "description": "string",
      "owner": "string or null",
      "priority": "high | medium | low",
      "deadline": "string or null",
      "done": false
    }
  ],
  "risks": [
    {
      "description": "string",
      "level": "high | medium | low",
      "mitigation": "string or null"
    }
  ],
  "participants": ["string"],
  "keyTopics": ["string"],
  "openQuestions": ["string"],
  "followUpSuggested": boolean
}

TRANSCRIPT:
${transcript}`;

  const result = await withTimeout(model.generateContent(prompt));
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Gemini returned invalid JSON. Check your API key and transcript format.');
  }
}

// ── Drift analysis — compare two meeting analyses ────────────────────────────
export async function compareMeetings(meetingA, meetingB) {
  const model = getClient().getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    }
  });

  const prompt = `You are a meeting intelligence agent comparing two meeting records to detect decision drift and recurring issues.

MEETING A (earlier): ${meetingA.title} (${meetingA.analyzedAt})
${JSON.stringify(meetingA.analysis, null, 2)}

MEETING B (later): ${meetingB.title} (${meetingB.analyzedAt})
${JSON.stringify(meetingB.analysis, null, 2)}

Analyze the two meetings and return ONLY valid JSON matching this schema:

{
  "driftItems": [
    {
      "topic": "string - the decision or task topic",
      "meetingA": "string - how it appeared in meeting A (status/owner/context)",
      "meetingB": "string - how it appeared in meeting B, or 'not mentioned'",
      "driftScore": 0,
      "driftType": "resolved | regressed | recurring | abandoned | new",
      "observation": "string - what changed or why this is notable"
    }
  ],
  "recurringBlockers": [
    {
      "description": "string",
      "appearsIn": ["Meeting A title", "Meeting B title"],
      "owner": "string or null",
      "severity": "high | medium | low"
    }
  ],
  "uncommittedOwners": [
    {
      "name": "string",
      "committed": ["list of tasks/decisions they owned in meeting A"],
      "followedUp": ["list of items showing progress in meeting B"],
      "missedItems": ["list of items with no visible follow-through"]
    }
  ],
  "overallDriftScore": 0,
  "summary": "string - 2-3 sentence plain-language summary of the drift between these meetings"
}

driftScore 0 = fully resolved / healthy, 100 = completely stalled / regressed.
overallDriftScore is the weighted average across all items.`;

  const result = await withTimeout(model.generateContent(prompt));
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Gemini returned invalid JSON for drift comparison.');
  }
}

// ── Watchdog analysis — scan all meetings for systemic issues ─────────────────
export async function watchdogScan(meetings, teamFilter = null) {
  const model = getClient().getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    }
  });

  const filtered = teamFilter
    ? meetings.filter(m =>
        JSON.stringify(m.analysis).toLowerCase().includes(teamFilter.toLowerCase())
      )
    : meetings;

  const summaries = filtered.map(m => ({
    id: m.id,
    title: m.title,
    date: m.analyzedAt,
    tasks: m.analysis?.tasks || [],
    risks: m.analysis?.risks || [],
    decisions: m.analysis?.decisions || [],
    participants: m.analysis?.participants || []
  }));

  const prompt = `You are a meeting intelligence watchdog scanning ${summaries.length} meeting record(s) for systemic issues.

MEETING HISTORY (chronological, oldest first):
${JSON.stringify(summaries, null, 2)}

Identify systemic patterns and return ONLY valid JSON matching this schema:

{
  "unresolvedRisks": [
    {
      "description": "string",
      "appearsInMeetings": ["meeting title"],
      "hasOwner": false,
      "owner": "string or null",
      "severity": "high | medium | low",
      "recommendation": "string"
    }
  ],
  "ownerlessTaskPatterns": [
    {
      "topic": "string",
      "examples": ["task 1", "task 2"],
      "appearsInMeetings": ["title"],
      "recommendation": "string"
    }
  ],
  "overloadedParticipants": [
    {
      "name": "string",
      "assignedTaskCount": 0,
      "meetingCount": 0,
      "tasks": ["task descriptions"],
      "riskLevel": "high | medium | low"
    }
  ],
  "recurringTopics": [
    {
      "topic": "string",
      "meetingCount": 0,
      "meetingTitles": ["title"],
      "neverResolved": true,
      "note": "string"
    }
  ],
  "healthScore": 0,
  "summary": "string - 3-4 sentence overall health assessment",
  "topPriorities": ["top 3 actionable recommendations"]
}

healthScore: 100 = excellent follow-through, 0 = systemic dysfunction.`;

  const result = await withTimeout(model.generateContent(prompt), 45_000);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Gemini returned invalid JSON for watchdog scan.');
  }
}

// ── Chat / REPL mode — conversational over meeting history ───────────────────
export async function chatWithHistory(userMessage, conversationHistory, meetingContext) {
  const model = getClient().getGenerativeModel({
    model: MODEL_ID,
    generationConfig: { temperature: 0.7 }
  });

  const systemContext = `You are TeamPulse, a meeting intelligence agent. You help teams understand their meeting history, track decisions, and follow through on commitments.

Available meeting context:
${JSON.stringify(meetingContext, null, 2)}

Be concise and actionable. Use bullet points for lists. If asked to create tasks or summaries, format them clearly.
Answer questions about decisions, risks, tasks, owners, and patterns across meetings.`;

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: systemContext }] },
      { role: 'model', parts: [{ text: 'Understood. I\'m ready to help analyze your meeting history.' }] },
      ...conversationHistory
    ]
  });

  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

// ── Skill prompts (persona layer) ────────────────────────────────────────────
const SKILL_PROMPTS = {
  'product-manager': `You are analyzing this meeting as a product manager. Prioritize: feature decisions, user impact, roadmap implications, delivery risks, and ownership clarity.`,

  'developer': `You are analyzing this meeting as a senior engineer. Prioritize: technical decisions, architecture implications, blockers, technical debt, and realistic deadlines.`,

  'founder': `You are analyzing this meeting as a founder/CEO. Prioritize: strategic decisions, resource allocation, team alignment, market risks, and high-level outcomes.`,

  'marketing': `You are analyzing this meeting as a marketing lead. Prioritize: campaign decisions, messaging, launch timelines, audience insights, and cross-team dependencies.`
};
