// /lib/configure.js
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

const configPath = path.join(process.cwd(), 'appcheck.config.json');

// Function to handle exit with a goodbye message
const handleExit = (message = 'Exiting configuration. Goodbye!') => {
  console.log(chalk.yellow(`\n${message}`));
  process.exit(0);
};

// Helper function to ensure a value is an array
const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
  return [];
};

// Function to open the main configuration menu
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
      handleExit();  // User selected "Exit"
    }
  } catch (error) {
    // Handle user force closing the prompt (Ctrl+C) gracefully
    if (error.isTtyError || error.name === 'PromptAbortedError' || error.message.includes('User force closed')) {
      handleExit();  // Gracefully handle exit without showing an error message
    } else {
      console.error(chalk.red('An unexpected error occurred:', error));
      process.exit(1);
    }
  }
};

// Function to configure translation settings
const configureTranslation = async () => {
  try {
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
      existingConfig = fs.readJsonSync(configPath);
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'translationDir',
        message: 'Enter the directory where translation files are stored (leave blank for API/database):',
        default: existingConfig.translationDir || '',
      },
      {
        type: 'input',
        name: 'apiEndpoint',
        message: 'Enter the API endpoint (without language code):',
        default: existingConfig.apiEndpoint || '',
      },
      {
        type: 'input',
        name: 'languageCodeFormat',
        message: 'Enter the language code format (e.g., "en", "en-US", "en_US"):',
        default: existingConfig.languageCodeFormat || 'en_US',
      },
      {
        type: 'checkbox',
        name: 'languages',
        message: 'Select languages to check:',
        choices: ['en', 'es', 'fr', 'de', 'no', 'ru', 'hu', 'ch', 'pl', 'it', 'pt'],
        default: existingConfig.languages || ['en'],
        validate: (input) => input.length > 0 || 'Please select at least one language!',
      },
      {
        type: 'input',
        name: 'projectDirs',
        message: 'Enter the directories to scan for project files (comma separated):',
        default: Array.isArray(existingConfig.projectDirs) ? existingConfig.projectDirs.join(', ') : existingConfig.projectDirs || './src',
        validate: (input) => input.trim().length > 0 || 'Please enter at least one directory!',
        filter: (input) => input.split(',').map((dir) => dir.trim()).filter(Boolean),
      },
      {
        type: 'input',
        name: 'translationFunction',
        message: 'Enter the translation function name (e.g., t, translate, i18n):',
        default: existingConfig.translationFunction || 't',
      },
      {
        type: 'confirm',
        name: 'configureMappings',
        message: 'Do you want to configure language mappings?',
        default: false,
      }
    ]);

    if (answers.configureMappings) {
      answers.languageMapping = [];
      for (const language of answers.languages) {
        const mappingAnswer = await inquirer.prompt({
          type: 'input',
          name: 'mapping',
          message: `Enter the mappings for ${language} (comma separated, e.g., "nb_NO,nn_NO"):`,
        });

        answers.languageMapping.push({
          language: language,
          mappings: mappingAnswer.mapping.split(',').map(m => m.trim())
        });
      }
    } else {
      answers.languageMapping = existingConfig.languageMapping || [];
    }

    const config = {
      ...existingConfig,
      ...answers,
      projectDirs: ensureArray(answers.projectDirs),
    };

    fs.writeJsonSync(configPath, config, { spaces: 2 });
    console.log(chalk.green('Translation configuration saved!'));
    console.log(chalk.blue('Project Directories:', JSON.stringify(config.projectDirs)));
  } catch (error) {
    console.error(chalk.red('An error occurred while configuring translations:', error));
    process.exit(1);
  }
};

// Function to configure file check settings
const configureFileCheck = async () => {
  try {
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
      existingConfig = fs.readJsonSync(configPath);
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectDirs',
        message: 'Enter the directories to scan for project files (comma separated):',
        default: Array.isArray(existingConfig.projectDirs) ? existingConfig.projectDirs.join(', ') : existingConfig.projectDirs || './src',
        validate: (input) => input.trim().length > 0 || 'Please enter at least one directory!',
        filter: (input) => input.split(',').map((dir) => dir.trim()).filter(Boolean),
      },
    ]);

    const config = {
      ...existingConfig,
      projectDirs: ensureArray(answers.projectDirs),
    };

    fs.writeJsonSync(configPath, config, { spaces: 2 });
    console.log(chalk.green('File check configuration saved!'));
    console.log(chalk.blue('Project Directories:', JSON.stringify(config.projectDirs)));
  } catch (error) {
    console.error(chalk.red('An error occurred while configuring file check:', error));
    process.exit(1);
  }
};

export { openMenu };
