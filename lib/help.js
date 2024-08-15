import chalk from 'chalk';

export const displayHelp = () => {
  console.log(chalk.green('AppCheck CLI Tool'));
  console.log(chalk.yellow('\nAvailable Commands:'));
  console.log(chalk.blue('  appcheck init'));
  console.log('    Opens the tools menu to configure and check files.');

  console.log(chalk.blue('  appcheck check-files'));
  console.log('    Lists all used and unused files in the configured directories, including file size and lines of code.');

  console.log(chalk.blue('  appcheck check-translations'));
  console.log('    Checks for unused or missing translation keys.');

  console.log(chalk.blue('  appcheck check-styling'));
  console.log('    Checks for unused styling.');

  console.log(chalk.blue('  appcheck check-functions'));
  console.log('    Checks for unused functions.');

  console.log(chalk.blue('  appcheck help'));
  console.log('    Displays help information.');

  console.log(chalk.green('\nFor more information, visit the documentation.'));
};
