// /lib/configure.js
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const configPath = path.join(process.cwd(), 'appcheck.config.json');

// Open the menu to choose between configuration options
const openMenu = async () => {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'menu',
        message: 'Select an option:',
        choices: ['Configure Translation', 'Configure File Check', 'Exit'],
      },
    ]);

    if (answers.menu === 'Configure Translation') {
      await configureTranslation();
    } else if (answers.menu === 'Configure File Check') {
      await configureFileCheck();
    } else {
      console.log(chalk.yellow('Exiting configuration. Goodbye!'));
      process.exit(0);
    }
  } catch (error) {
    if (error.isTtyError) {
      console.log(chalk.yellow('\nPrompt couldn\'t be rendered in the current environment'));
    } else {
      console.log(chalk.yellow('\nOperation cancelled. Goodbye!'));
    }
    process.exit(0);
  }
};

// Configure the translation settings
const configureTranslation = async () => {
  try {
    // Read existing config if it exists
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
      existingConfig = fs.readJsonSync(configPath);
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'translationDir',
        message: 'Enter the directory where translation files are stored:',
        validate: (input) => fs.existsSync(input) || 'Directory does not exist!',
        default: existingConfig.translationDir || './translations',
      },
      {
        type: 'input',
        name: 'projectDirs',
        message: 'Enter the directories to scan for project files (comma separated):',
        default: existingConfig.projectDirs ? existingConfig.projectDirs.join(', ') : './src',
        validate: (input) => input.trim().length > 0 || 'Please enter at least one directory!',
        filter: (input) => input.split(',').map((dir) => dir.trim()).filter(Boolean),
      },
      {
        type: 'input',
        name: 'translationFunction',
        message: 'Enter the translation function name (e.g., t, translate, i18n):',
        default: existingConfig.translationFunction || 't',
      },
    ]);

    const config = {
      ...existingConfig,
      translationDir: answers.translationDir,
      projectDirs: Array.isArray(answers.projectDirs) 
        ? answers.projectDirs 
        : answers.projectDirs.split(',').map((dir) => dir.trim()).filter(Boolean),
      translationFunction: answers.translationFunction,
    };

    fs.writeJsonSync(configPath, config, { spaces: 2 });
    console.log(chalk.green('Translation configuration saved!'));
  } catch (error) {
    console.log(chalk.yellow('\nOperation cancelled. Goodbye!'));
    process.exit(0);
  }
};

// Configure the file check settings
const configureFileCheck = async () => {
  try {
    // Read existing config if it exists
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
      existingConfig = fs.readJsonSync(configPath);
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectDirs',
        message: 'Enter the directories to scan for project files (comma separated):',
        default: existingConfig.projectDirs ? existingConfig.projectDirs.join(', ') : './src',
        validate: (input) => input.trim().length > 0 || 'Please enter at least one directory!',
        filter: (input) => input.split(',').map((dir) => dir.trim()).filter(Boolean),
      },
    ]);

    // Update only the file check settings, preserving other config settings
    const config = {
      ...existingConfig,
      projectDirs: Array.isArray(answers.projectDirs) 
        ? answers.projectDirs 
        : answers.projectDirs.split(',').map((dir) => dir.trim()).filter(Boolean),
    };

    fs.writeJsonSync(configPath, config, { spaces: 2 });
    console.log(chalk.green('File check configuration saved!'));
  } catch (error) {
    console.log(chalk.yellow('\nOperation cancelled. Goodbye!'));
    process.exit(0);
  }
};

export { openMenu };