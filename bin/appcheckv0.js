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

// Function to handle clean exit
const handleExit = () => {
  console.log(chalk.yellow('\nOperation cancelled. Goodbye!'));
  process.exit(0);
};

// Listen for interrupt signals
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

// Version
program.version('1.0.0').description('AppCheck CLI Tool');

// Initialize Command
program
  .command('init')
  .description('Opens the tools menu')
  .action(async () => {
    try {
      console.log(chalk.blue('Welcome to AppCheck!'));
      await configure.openMenu();
    } catch (error) {
      console.log(chalk.yellow('\nOperation cancelled. Goodbye!'));
      process.exit(0);
    }
  });

// Check Files Command
program
  .command('check-files')
  .description('List all used and unused files, number of lines of code, file sizes, etc.')
  .action(async () => {
    try {
      await checkFiles.analyze();
    } catch (error) {
      console.error(chalk.red('An error occurred while checking files:'), error.message);
      process.exit(1);
    }
  });

// Translation Check Command
program
  .command('check-translations')
  .description('Check for unused or missing translation keys')
  .action(async () => {
    try {
      await translationCheck.analyzeTranslations();
    } catch (error) {
      console.error(chalk.red('An error occurred while checking translations:'), error.message);
      process.exit(1);
    }
  });

// Styling Check Command
program
  .command('check-styling')
  .description('Check for unused styling')
  .action(async () => {
    try {
      await stylingCheck.analyzeStyling();
    } catch (error) {
      console.error(chalk.red('An error occurred while checking styling:'), error.message);
      process.exit(1);
    }
  });

// Function Check Command
program
  .command('check-functions')
  .description('Check for unused functions')
  .action(async () => {
    try {
      await functionCheck.analyzeFunctions();
    } catch (error) {
      console.error(chalk.red('An error occurred while checking functions:'), error.message);
      process.exit(1);
    }
  });

// Credential Check Command
program
  .command('check-credentials')
  .description('Check for credentials in project files and .env files')
  .action(async () => {
    try {
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
    } catch (error) {
      console.error(chalk.red('An error occurred while checking credentials:'), error.message);
      process.exit(1);
    }
  });

// Help Command
program
  .command('help')
  .description('Displays help information')
  .action(() => {
    try {
      help.displayHelp();
    } catch (error) {
      console.error(chalk.red('An error occurred while displaying help:'), error.message);
      process.exit(1);
    }
  });

// Parse the command line arguments
program.parse(process.argv);