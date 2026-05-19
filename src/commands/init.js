import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { initDB } from '../utils/memory.js';
import { printSuccess, printError, printInfo, printWarn } from '../utils/ui.js';

export async function initCommand() {
  await initDB();

  console.log('\n' + chalk.bold.cyan('  TeamPulse Setup Wizard') + '\n');
  console.log(chalk.dim('  This will configure your TeamPulse environment.\n'));

  // Check for existing .env
  const envPath = join(process.cwd(), '.env');
  const hasEnv = existsSync(envPath);
  let existingKey = '';
  if (hasEnv) {
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(/GEMINI_API_KEY=(.+)/);
    if (match) existingKey = match[1].trim();
  }

  const keyPrompt = existingKey
    ? `GEMINI_API_KEY (current: ${existingKey.slice(0, 8)}...)`
    : 'GEMINI_API_KEY (get free at aistudio.google.com/app/apikey)';

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: keyPrompt,
      default: existingKey || '',
      validate: v => v.length > 10 || 'Please enter a valid API key'
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
      ]
    },
    {
      type: 'input',
      name: 'teamName',
      message: 'Team name (optional, used in reports):',
      default: ''
    },
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Save these settings?',
      default: true
    }
  ]);

  const { apiKey, defaultSkill, teamName, confirmed } = answers;

  if (!confirmed) {
    printWarn('Setup cancelled. No changes saved.');
    return;
  }

  // Write .env
  const envLines = [
    `GEMINI_API_KEY=${apiKey}`,
    `DEFAULT_SKILL=${defaultSkill}`,
    teamName ? `TEAM_NAME=${teamName}` : null,
    'NODE_ENV=development'
  ].filter(Boolean).join('\n') + '\n';

  try {
    writeFileSync(envPath, envLines, 'utf-8');
    printSuccess('.env file written');
  } catch (err) {
    printError(`Could not write .env: ${err.message}`);
    return;
  }

  console.log('\n' + chalk.bold('  Setup complete!\n'));
  printInfo(`Default skill: ${chalk.cyan(defaultSkill)}`);
  printInfo(`Memory stored at: ${chalk.dim('~/.teampulse/memory.json')}`);
  console.log('\n  ' + chalk.dim('Next steps:'));
  console.log('  ' + chalk.cyan('teampulse analyze <your-transcript.txt>'));
  console.log('  ' + chalk.cyan('teampulse history') + '\n');
}
