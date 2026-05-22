import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { callProvider, resolveProvider, getProviderLabel } from '../services/provider.js';
import { getRecentContext, getMeetingById, initDB } from '../utils/memory.js';
import { printAssistantResponse, printError, printInfo, printSuccess } from '../utils/ui.js';

const HELP_TEXT = `
  ${chalk.bold('Chat commands:')}
  ${chalk.cyan('/meetings')}          List recent meetings in memory
  ${chalk.cyan('/use <meeting-id>')}  Focus chat on a specific meeting
  ${chalk.cyan('/clear')}             Clear conversation history
  ${chalk.cyan('/help')}              Show this help
  ${chalk.cyan('/exit')} or Ctrl+C   Exit chat mode

  ${chalk.bold('Example prompts:')}
  ${chalk.dim('› what decisions were made last sprint?')}
  ${chalk.dim('› show all tasks without owners')}
  ${chalk.dim('› summarize the main risks from recent meetings')}
  ${chalk.dim('› who owns the most open tasks?')}
`;

export async function chatCommand(options) {
  await initDB();
  const { name: provName, model } = resolveProvider(options.provider || 'gemini', options.model);
  const provLabel = getProviderLabel(provName, model);

  console.log(chalk.bold.cyan('\n  ╭─ Chat mode ──────────────────────────────────────────────╮'));
  console.log(chalk.dim(`  │  ${provLabel.padEnd(57)}│`));
  console.log(chalk.dim('  │  Ask anything about your meeting history.                  │'));
  console.log(chalk.dim('  │  Type /help for commands, Ctrl+C to exit.                  │'));
  console.log(chalk.bold.cyan('  ╰─────────────────────────────────────────────────────────────╯\n'));

  let meetingContext = await getRecentContext(5);

  if (options.meeting) {
    const specific = await getMeetingById(options.meeting);
    if (specific) {
      meetingContext = [specific];
      printInfo(`Focused on meeting: ${specific.title}`);
    } else {
      printError(`Meeting ID not found: ${options.meeting}`);
    }
  }

  if (meetingContext.length === 0) {
    console.log(chalk.yellow('  ⚠ No meetings in memory yet.'));
    console.log(chalk.dim(`  Run ${chalk.cyan('teampulse analyze <file>')} first to load a meeting.\n`));
  } else {
    printInfo(`Loaded ${meetingContext.length} meeting(s) into context`);
  }

  const conversationHistory = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  let processing = false;

  const prompt = () => {
    process.stdout.write(chalk.cyan('\n  teampulse') + chalk.dim(' › '));
  };

  rl.on('line', async (input) => {
    const line = input.trim();
    if (!line) { prompt(); return; }

    if (line.startsWith('/')) {
      await handleSlashCommand(line, rl, meetingContext, conversationHistory, options);
      if (line === '/exit' || line === '/quit') return;
      prompt();
      return;
    }

    if (processing) {
      process.stdout.write(chalk.dim('\n  (still thinking — please wait)\n'));
      prompt();
      return;
    }

    processing = true;
    const spinner = ora({ text: chalk.dim('Thinking...'), color: 'cyan', indent: 2 }).start();

    try {
      const freshContext = await getRecentContext(5);
      const chatPrompt = buildChatPrompt(line, conversationHistory, freshContext);
      const response = await callProvider(provName, model, chatPrompt, { temperature: 0.7 });

      spinner.stop();
      console.log('\n' + chalk.dim('  ─────────────────────────────────────────────────────────────'));
      printAssistantResponse(response);
      console.log(chalk.dim('  ─────────────────────────────────────────────────────────────'));

      conversationHistory.push({ role: 'user', content: line });
      conversationHistory.push({ role: 'assistant', content: response });

      if (conversationHistory.length > 20) conversationHistory.splice(0, 2);
    } catch (err) {
      spinner.fail(chalk.red('Error'));
      printError(err.message);
    } finally {
      processing = false;
    }

    prompt();
  });

  let exiting = false;
  const exit = (msg) => {
    if (exiting) return;
    exiting = true;
    console.log(chalk.dim(msg));
    process.exit(0);
  };

  rl.on('close', () => exit('\n\n  Exiting chat mode. Goodbye!\n'));
  process.on('SIGINT', () => exit('\n\n  Session ended.\n'));

  prompt();
}

function buildChatPrompt(userMessage, history, meetingContext) {
  const contextStr = JSON.stringify(meetingContext, null, 2);
  const historyStr = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n');

  return `You are TeamPulse, a meeting intelligence agent. You help teams understand their meeting history, track decisions, and follow through on commitments.

Available meeting context:
${contextStr}

Conversation so far:
${historyStr || '(no previous messages)'}

Be concise and actionable. Use bullet points for lists. If asked to create tasks or summaries, format them clearly.
Answer questions about decisions, risks, tasks, owners, and patterns across meetings.

User: ${userMessage}
Assistant:`;
}

async function handleSlashCommand(line, rl, meetingContext, conversationHistory, options) {
  const [cmd, ...args] = line.split(' ');

  switch (cmd) {
    case '/help':
      console.log(HELP_TEXT);
      break;

    case '/meetings': {
      const { getMeetings } = await import('../utils/memory.js');
      const meetings = await getMeetings(10);
      if (meetings.length === 0) {
        console.log(chalk.yellow('\n  No meetings stored yet.\n'));
      } else {
        console.log(chalk.bold('\n  Recent meetings:\n'));
        meetings.forEach(m => {
          const date = new Date(m.analyzedAt).toLocaleDateString();
          const tasks = m.analysis?.tasks?.length || 0;
          const decisions = m.analysis?.decisions?.length || 0;
          const prov = m.provider ? chalk.dim(` · ${m.provider}`) : '';
          console.log(
            `  ${chalk.cyan(m.id)}\n` +
            `  ${chalk.white(m.title)} ${chalk.dim(`(${date})`)}${prov} ` +
            `${chalk.dim(`· ${decisions} decisions · ${tasks} tasks`)}\n`
          );
        });
      }
      break;
    }

    case '/use': {
      const id = args[0];
      if (!id) { printError('Usage: /use <meeting-id>'); break; }
      const m = await getMeetingById(id);
      if (!m) { printError(`Meeting not found: ${id}`); break; }
      meetingContext.length = 0;
      meetingContext.push(m);
      printSuccess(`Now focused on: ${m.title}`);
      break;
    }

    case '/clear':
      conversationHistory.length = 0;
      printSuccess('Conversation history cleared.');
      break;

    case '/exit':
    case '/quit':
      rl.close();
      break;

    default:
      printError(`Unknown command: ${cmd}. Type /help for available commands.`);
  }
}
