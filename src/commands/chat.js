import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { chatWithHistory } from '../services/gemini.js';
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

  console.log(chalk.bold.cyan('\n  ╭─ Chat mode ──────────────────────────────────────────────╮'));
  console.log(chalk.dim('  │  Ask anything about your meeting history.                  │'));
  console.log(chalk.dim('  │  Type /help for commands, Ctrl+C to exit.                  │'));
  console.log(chalk.bold.cyan('  ╰─────────────────────────────────────────────────────────────╯\n'));

  // Load context
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

  // Conversation history (Gemini CLI pattern: keep full history in memory)
  const conversationHistory = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  // Guard against concurrent requests while Gemini is responding
  let processing = false;

  const prompt = () => {
    process.stdout.write(chalk.cyan('\n  teampulse') + chalk.dim(' › '));
  };

  rl.on('line', async (input) => {
    const line = input.trim();
    if (!line) { prompt(); return; }

    // ── Slash commands ─────────────────────────────────────────────────────
    if (line.startsWith('/')) {
      await handleSlashCommand(line, rl, meetingContext, conversationHistory, options);
      if (line === '/exit' || line === '/quit') return;
      prompt();
      return;
    }

    // Drop input while a request is already in flight
    if (processing) {
      process.stdout.write(chalk.dim('\n  (still thinking — please wait)\n'));
      prompt();
      return;
    }

    // ── Regular chat message ───────────────────────────────────────────────
    processing = true;
    const spinner = ora({ text: chalk.dim('Thinking...'), color: 'cyan', indent: 2 }).start();

    try {
      const freshContext = await getRecentContext(5);
      const response = await chatWithHistory(line, conversationHistory, freshContext);

      spinner.stop();
      console.log('\n' + chalk.dim('  ─────────────────────────────────────────────────────────────'));
      printAssistantResponse(response);
      console.log(chalk.dim('  ─────────────────────────────────────────────────────────────'));

      conversationHistory.push({ role: 'user', parts: [{ text: line }] });
      conversationHistory.push({ role: 'model', parts: [{ text: response }] });

      // Keep last 10 exchanges (20 turns) to avoid ballooning context
      if (conversationHistory.length > 20) {
        conversationHistory.splice(0, 2);
      }
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
          console.log(
            `  ${chalk.cyan(m.id)}\n` +
            `  ${chalk.white(m.title)} ${chalk.dim(`(${date})`)} ` +
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
