// @ts-check
import { program } from 'commander';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerBatchCommand } from './commands/batch.js';

// Importa otros comandos existentes (asumiendo que exportan funciones de registro similares)
// Si los comandos existentes no tienen registerXxx, se pueden importar y registrar manualmente.

program
  .name('teampulse')
  .description('CLI de analisis de reuniones con IA')
  .version('1.0.0');

// Registra comandos con las nuevas utilidades
registerAnalyzeCommand(program);
registerBatchCommand(program);

// Aquí se registrarí¬¬an los demá¬¬s comandos si ya exportan funciones de registro:
// import { registerChatCommand } from './commands/chat.js';
// registerChatCommand(program);

program.parse();

export default program;
