#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import * as configure from '../lib/configure.js';
import * as checkFiles from '../lib/checkFiles.js';
import * as translationCheck from '../lib/translationCheck.js';
import * as stylingCheck from '../lib/stylingCheck.js';
import * as functionCheck from '../lib/functionCheck.js';
import { checkCredentials } from '../lib/credentialCheck.js';
import * as help from '../lib/help.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { notifyVersionUpdate } from '../lib/versionCheck.js';
import { createSpinner } from '../lib/customSpinner.js';

// Get the current directory name (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the version from the package's root package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const currentVersion = packageJson.version;

// Function to handle clean exit
const handleExit = () => {
  console.log(chalk.yellow('\nOperation cancelled. Goodbye!'));
  process.exit(0);
};

// Listen for interrupt signals
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

// Version
program.version(currentVersion).description('AppCheck CLI Tool');

// Initialize spinner
const spinner = createSpinner();

// Pre-check: Check for package updates
const checkForUpdates = async () => {
  spinner.start('Checking for updates...');
  const updateMessage = await notifyVersionUpdate('appcheck-cli', currentVersion);

  if (updateMessage) {
    spinner.succeed(updateMessage);
  } else {
    spinner.succeed('You are using the latest version.');
  }
};

// Wrapper to check for updates before running commands
const wrapCommand = (commandFunction) => {
  return async () => {
    try {
      await checkForUpdates();
      await commandFunction();
    } catch (error) {
      spinner.fail('An error occurred during the operation: ' + error.message);
      process.exit(1);
    }
  };
};

// Initialize Command
program
  .command('init')
  .description('Opens the tools menu')
  .action(wrapCommand(async () => {
    console.log(chalk.blue('Welcome to AppCheck!'));
    await configure.openMenu();
  }));

// Check Files Command
program
  .command('check-files')
  .description('List all used and unused files, number of lines of code, file sizes, etc.')
  .action(wrapCommand(checkFiles.analyze));

// Translation Check Command
program
  .command('check-translations')
  .description('Check for unused or missing translation keys')
  .action(wrapCommand(translationCheck.analyzeTranslations));

// Styling Check Command
program
  .command('check-styling')
  .description('Check for unused styling')
  .action(wrapCommand(stylingCheck.analyzeStyling));

// Function Check Command
program
  .command('check-functions')
  .description('Check for unused functions')
  .action(wrapCommand(functionCheck.analyzeFunctions));

// Credential Check Command
program
  .command('check-credentials')
  .description('Check for credentials in project files and .env files')
  .action(wrapCommand(async () => {
    const configPath = path.join(process.cwd(), 'appcheck.config.json');
    if (!fs.existsSync(configPath)) {
      console.error(chalk.red('Configuration file not found. Please run "appcheck init" first.'));
      process.exit(1);
    }
    const config = await fs.readJSON(configPath);
    if (!config.projectDirs || !Array.isArray(config.projectDirs)) {
      console.error(chalk.red('Invalid configuration: projectDirs should be an array.'));
      process.exit(1);
    }
    await checkCredentials({ projectDirs: config.projectDirs });
  }));

// Help Command
program
  .command('help')
  .description('Displays help information')
  .action(wrapCommand(help.displayHelp));

// Parse the command line arguments
program.parse(process.argv);
