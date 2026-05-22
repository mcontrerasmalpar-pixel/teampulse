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
      gemini: parse('GEMINI_API_KEY'),
      anthropic: parse('ANTHROPIC_API_KEY'),
      openai: parse('OPENAI_API_KEY'),
      skill: parse('DEFAULT_SKILL'),
      team: parse('TEAM_NAME'),
    };
  }

  const maskKey = (k) => k ? `${k.slice(0, 8)}…` : '';

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'defaultProvider',
      message: 'Default AI provider:',
      choices: [
        { name: 'Gemini (free tier available — aistudio.google.com)', value: 'gemini' },
        { name: 'Claude (console.anthropic.com)', value: 'claude' },
        { name: 'OpenAI / GPT-4 (platform.openai.com)', value: 'openai' },
      ],
      default: 'gemini'
    },
    {
      type: 'input',
      name: 'geminiKey',
      message: existing.gemini
        ? `GEMINI_API_KEY (current: ${maskKey(existing.gemini)}  — leave blank to keep):`
        : 'GEMINI_API_KEY (get free key at aistudio.google.com/app/apikey):',
      default: existing.gemini || '',
    },
    {
      type: 'input',
      name: 'anthropicKey',
      message: existing.anthropic
        ? `ANTHROPIC_API_KEY (current: ${maskKey(existing.anthropic)}  — leave blank to keep):`
        : 'ANTHROPIC_API_KEY (optional — leave blank to skip):',
      default: existing.anthropic || '',
    },
    {
      type: 'input',
      name: 'openaiKey',
      message: existing.openai
        ? `OPENAI_API_KEY (current: ${maskKey(existing.openai)}  — leave blank to keep):`
        : 'OPENAI_API_KEY (optional — leave blank to skip):',
      default: existing.openai || '',
    },
    {
      type: 'list',
      name: 'defaultSkill',
      message: 'Default analysis skill/persona:',
      choices: [
        { name: 'Product Manager — decisions, roadmap, delivery', value: 'product-manager' },
        { name: 'Developer — technical decisions, blockers, debt', value: 'developer' },
        { name: 'Founder — strategy, resources, alignment', value: 'founder' },
        { name: 'Marketing — campaigns, messaging, launches', value: 'marketing' }
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

  const { defaultProvider, geminiKey, anthropicKey, openaiKey, defaultSkill, teamName, confirmed } = answers;

  if (!confirmed) {
    printWarn('Setup cancelled. No changes saved.');
    return;
  }

  const lines = [
    geminiKey    ? `GEMINI_API_KEY=${geminiKey}` : null,
    anthropicKey ? `ANTHROPIC_API_KEY=${anthropicKey}` : null,
    openaiKey    ? `OPENAI_API_KEY=${openaiKey}` : null,
    `DEFAULT_PROVIDER=${defaultProvider}`,
    `DEFAULT_SKILL=${defaultSkill}`,
    teamName     ? `TEAM_NAME=${teamName}` : null,
    'NODE_ENV=development'
  ].filter(Boolean).join('\n') + '\n';

  try {
    writeFileSync(envPath, lines, 'utf-8');
    printSuccess('.env file written');
  } catch (err) {
    printError(`Could not write .env: ${err.message}`);
    return;
  }

  console.log('\n' + chalk.bold('  Setup complete!\n'));
  printInfo(`Default provider: ${chalk.cyan(defaultProvider)}`);
  printInfo(`Default skill:    ${chalk.cyan(defaultSkill)}`);
  printInfo(`Memory stored at: ${chalk.dim('~/.teampulse/memory.json')}`);
  console.log('\n  ' + chalk.dim('Next steps:'));
  console.log('  ' + chalk.cyan('teampulse analyze <your-transcript.txt>'));
  console.log('  ' + chalk.cyan('teampulse history') + '\n');
}
