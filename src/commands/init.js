import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { initDB } from '../utils/memory.js';
import { printSuccess, printError, printInfo, printWarn } from '../utils/ui.js';

export async function initCommand() {
  await initDB();

  console.log('\n' + chalk.bold.cyan('  TeamPulse Setup Wizard') + '\n');
  console.log(chalk.dim('  Configure your AI providers and default preferences.\n'));

  const envPath = join(process.cwd(), '.env');
  const hasEnv = existsSync(envPath);
  let existing = {};
  if (hasEnv) {
    const content = readFileSync(envPath, 'utf-8');
    const parse = (key) => { const m = content.match(new RegExp(`${key}=(.+)`)); return m ? m[1].trim() : ''; };
    existing = {
      gemini:      parse('GEMINI_API_KEY'),
      anthropic:   parse('ANTHROPIC_API_KEY'),
      openai:      parse('OPENAI_API_KEY'),
      mistral:     parse('MISTRAL_API_KEY'),
      ollamaHost:  parse('OLLAMA_HOST'),
      ollamaModel: parse('OLLAMA_DEFAULT_MODEL'),
      provider:    parse('DEFAULT_PROVIDER'),
      skill:       parse('DEFAULT_SKILL'),
      team:        parse('TEAM_NAME'),
    };
  }

  const maskKey = (k) => k ? `${k.slice(0, 8)}…` : '';

  const { defaultProvider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'defaultProvider',
      message: 'Default AI provider:',
      choices: [
        { name: 'Gemini          free tier  · aistudio.google.com/app/apikey', value: 'gemini' },
        { name: 'Claude          paid       · console.anthropic.com',           value: 'claude' },
        { name: 'OpenAI / GPT-4  paid       · platform.openai.com/api-keys',   value: 'openai' },
        { name: 'Mistral         paid       · console.mistral.ai',             value: 'mistral' },
        { name: 'Ollama          local/free · no API key required',            value: 'ollama' },
      ],
      default: existing.provider || 'gemini'
    },
  ]);

  const keyAnswers = await inquirer.prompt([
    {
      type: 'password',
      name: 'geminiKey',
      mask: '*',
      message: existing.gemini
        ? `GEMINI_API_KEY (current: ${maskKey(existing.gemini)} — leave blank to keep):`
        : 'GEMINI_API_KEY (free key at aistudio.google.com/app/apikey — leave blank to skip):',
      default: '',
    },
    {
      type: 'password',
      name: 'anthropicKey',
      mask: '*',
      message: existing.anthropic
        ? `ANTHROPIC_API_KEY (current: ${maskKey(existing.anthropic)} — leave blank to keep):`
        : 'ANTHROPIC_API_KEY (optional — leave blank to skip):',
      default: '',
    },
    {
      type: 'password',
      name: 'openaiKey',
      mask: '*',
      message: existing.openai
        ? `OPENAI_API_KEY (current: ${maskKey(existing.openai)} — leave blank to keep):`
        : 'OPENAI_API_KEY (optional — leave blank to skip):',
      default: '',
    },
    {
      type: 'password',
      name: 'mistralKey',
      mask: '*',
      message: existing.mistral
        ? `MISTRAL_API_KEY (current: ${maskKey(existing.mistral)} — leave blank to keep):`
        : 'MISTRAL_API_KEY (optional — get one at console.mistral.ai):',
      default: '',
    },
  ]);

  // Use existing values when user left input blank
  const geminiKey    = keyAnswers.geminiKey    || existing.gemini    || '';
  const anthropicKey = keyAnswers.anthropicKey || existing.anthropic || '';
  const openaiKey    = keyAnswers.openaiKey    || existing.openai    || '';
  const mistralKey   = keyAnswers.mistralKey   || existing.mistral   || '';

  const ollamaAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'ollamaHost',
      message: 'Ollama host (leave blank for default http://localhost:11434):',
      default: existing.ollamaHost || '',
    },
    {
      type: 'input',
      name: 'ollamaModel',
      message: 'Default Ollama model (e.g. mistral, llama3, phi3):',
      default: existing.ollamaModel || 'mistral',
    },
  ]);

  const prefsAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'defaultSkill',
      message: 'Default analysis skill/persona:',
      choices: [
        { name: 'Product Manager — decisions, roadmap, delivery',      value: 'product-manager' },
        { name: 'Developer      — technical decisions, blockers, debt', value: 'developer' },
        { name: 'Founder        — strategy, resources, alignment',      value: 'founder' },
        { name: 'Marketing      — campaigns, messaging, launches',      value: 'marketing' }
      ],
      default: existing.skill || 'product-manager'
    },
    {
      type: 'input',
      name: 'teamName',
      message: 'Team name (optional, used in reports):',
      default: existing.team || ''
    },
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Save these settings?',
      default: true
    }
  ]);

  const { defaultSkill, teamName, confirmed } = prefsAnswers;
  const { ollamaHost, ollamaModel } = ollamaAnswers;

  if (!confirmed) {
    printWarn('Setup cancelled. No changes saved.');
    return;
  }

  const lines = [
    geminiKey    ? `GEMINI_API_KEY=${geminiKey}`         : null,
    anthropicKey ? `ANTHROPIC_API_KEY=${anthropicKey}`   : null,
    openaiKey    ? `OPENAI_API_KEY=${openaiKey}`         : null,
    mistralKey   ? `MISTRAL_API_KEY=${mistralKey}`       : null,
    ollamaHost   ? `OLLAMA_HOST=${ollamaHost}`           : null,
    ollamaModel  ? `OLLAMA_DEFAULT_MODEL=${ollamaModel}` : null,
    `DEFAULT_PROVIDER=${defaultProvider}`,
    `DEFAULT_SKILL=${defaultSkill}`,
    teamName     ? `TEAM_NAME=${teamName}`               : null,
    'NODE_ENV=development'
  ].filter(Boolean).join('\n') + '\n';

  try {
    // 0o600 — only the owner can read/write .env (no group/world access)
    writeFileSync(envPath, lines, { encoding: 'utf-8', mode: 0o600 });
    printSuccess('.env file written (permissions: 600 — owner only)');
  } catch (err) {
    printError(`Could not write .env: ${err.message}`);
    return;
  }

  console.log('\n' + chalk.bold('  Setup complete!\n'));
  printInfo(`Default provider: ${chalk.cyan(defaultProvider)}`);
  if (defaultProvider === 'ollama') {
    printInfo(`Ollama model:     ${chalk.cyan(ollamaModel || 'mistral')}`);
    printInfo(`Ollama host:      ${chalk.dim(ollamaHost || 'http://localhost:11434')}`);
    console.log(`\n  ${chalk.dim('Make sure Ollama is running:')} ${chalk.cyan('ollama serve')}`);
    console.log(`  ${chalk.dim('Pull your model:')}              ${chalk.cyan(`ollama pull ${ollamaModel || 'mistral'}`)}`);
  }
  printInfo(`Default skill:    ${chalk.cyan(defaultSkill)}`);
  printInfo(`Memory stored at: ${chalk.dim('~/.teampulse/memory.json')} ${chalk.dim('(mode 600)')}`);
  console.log('\n  ' + chalk.dim('Next steps:'));
  console.log('  ' + chalk.cyan('teampulse analyze <your-transcript.txt>'));
  console.log('  ' + chalk.cyan('teampulse history') + '\n');
}
