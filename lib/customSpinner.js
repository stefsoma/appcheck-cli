// /lib/customSpinner.js
import chalk from 'chalk';

export const createSpinner = () => {
  let interval;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let currentMessage = '';

  const clearLine = () => {
    process.stdout.write('\r\x1b[K');
  };

  return {
    start: (message) => {
      clearLine();
      currentMessage = message;
      process.stdout.write(chalk.blue(`${frames[0]} ${message}`));
      interval = setInterval(() => {
        clearLine();
        i = (i + 1) % frames.length;
        process.stdout.write(chalk.blue(`${frames[i]} ${currentMessage}`));
      }, 80);
    },
    update: (message) => {
      clearLine();
      currentMessage = message;
      process.stdout.write(chalk.blue(`${frames[i]} ${message}`));
    },
    succeed: (message) => {
      clearInterval(interval);
      clearLine();
      console.log(`${chalk.green('✔')} ${message}`);
    },
    fail: (message) => {
      clearInterval(interval);
      clearLine();
      console.log(`${chalk.red('✖')} ${message}`);
    }
  };
};