import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';
import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';

// Load translations from a JSON file
const loadTranslations = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Translation file not found: ${filePath}`);
  }
  const content = fs.readJsonSync(filePath);
  if (Object.keys(content).length === 0) {
    console.log(chalk.yellow(`Skipping empty translation file: ${filePath}`));
    return null;
  }
  return content;
};

// Load and merge translations from JSON files within any directory under translationDir
const loadTranslationsFromDir = (translationDir, language) => {
  // This will handle both nested and flat structures
  const files = globSync(`${translationDir}/**/${language}.json`);
  let translations = {};

  files.forEach((file) => {
    const jsonContent = loadTranslations(file);
    if (jsonContent) {
      translations = {
        ...translations,
        ...jsonContent,
      };
    }
  });

  // Fallback to check subdirectories under the language folder
  const fallbackFiles = globSync(`${translationDir}/${language}/**/*.json`);
  fallbackFiles.forEach((file) => {
    const jsonContent = loadTranslations(file);
    if (jsonContent) {
      translations = {
        ...translations,
        ...jsonContent,
      };
    }
  });

  return translations;
};

// Fetch translations from an API endpoint
const fetchTranslationsFromAPI = async (apiEndpoint, language) => {
  try {
    const response = await axios.get(`${apiEndpoint}${language}`);
    if (response.status !== 200 || !Array.isArray(response.data)) {
      throw new Error(`Unexpected format or status for translations of language ${language}`);
    }
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch translations for ${language}: ${error.message}`);
  }
};

// Helper function to load and parse the .appcheckignore file
const loadAppCheckIgnore = () => {
  const ignoreFilePath = path.join(process.cwd(), '.appcheckignore');
  if (!fs.existsSync(ignoreFilePath)) return {};

  const ignoreContent = fs.readFileSync(ignoreFilePath, 'utf-8');
  const ignoreConfig = ignoreContent.split('\n').reduce((acc, line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return acc;

    const [section, value] = line.split(':').map((item) => item.trim());
    if (section && value) {
      if (!acc[section]) acc[section] = [];
      acc[section].push(value);
    } else if (section) {
      acc[section] = true; // For boolean flags like "keysWithNumbers"
    }
    return acc;
  }, {});

  return ignoreConfig;
};

// Helper function to check if a key or value should be ignored based on .appcheckignore rules
const shouldIgnore = (key, value, ignoreConfig = {}) => {
  const { keys = [], prefixes = [], suffixes = [], patterns = [], keysWithNumbers = false } = ignoreConfig;

  if (keys.some((ignoredKey) => key === ignoredKey || (ignoredKey.endsWith('*') && key.startsWith(ignoredKey.slice(0, -1))))) {
    return true;
  }

  if (prefixes.some((prefix) => key.startsWith(prefix))) {
    return true;
  }

  if (suffixes.some((suffix) => key.endsWith(suffix))) {
    return true;
  }

  if (patterns.some((pattern) => new RegExp(pattern).test(value))) {
    return true;
  }

  if (keysWithNumbers && /\d/.test(key)) {
    return true;
  }

  return false;
};

// Find all translation keys in a loaded JSON object or API response
const findTranslationKeys = (translations, ignoreConfig) => {
  const keys = new Set();

  const traverse = (obj, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        traverse(value, fullKey);
      } else {
        if (!shouldIgnore(fullKey, value, ignoreConfig)) {
          keys.add(fullKey);
        }
      }
    }
  };

  if (typeof translations === 'object' && translations !== null) {
    traverse(translations);
  } else {
    console.error(chalk.red('Unexpected data format for translations:', typeof translations));
  }

  return [...keys];
};

// Check for duplicate translation values
const checkForDuplicateValues = (translations) => {
  const valueMap = new Map();
  const duplicateDetails = [];

  const traverse = (obj, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        traverse(value, fullKey);
      } else {
        if (valueMap.has(value)) {
          duplicateDetails.push({
            value,
            keys: [valueMap.get(value).key, fullKey],
          });
        } else {
          valueMap.set(value, { key: fullKey });
        }
      }
    }
  };

  traverse(translations);

  return duplicateDetails;
};

// Check if the translation keys are used in project files
const checkTranslationUsage = (directories, translationKeys, translationFunction) => {
  const usedKeys = new Set();
  const fileExtensions = ['.js', '.jsx', '.ts', '.tsx'];

  directories.forEach((directory) => {
    const files = globSync(`${directory}/**/*{${fileExtensions.join(',')}}`);
    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      translationKeys.forEach((key) => {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`${translationFunction}\\(['"]${escapedKey}['"]\\)`, 'g');
        if (pattern.test(content)) {
          usedKeys.add(key);
        }
      });
    });
  });

  return { usedKeys, unusedKeys: new Set([...translationKeys].filter((key) => !usedKeys.has(key))) };
};

// Check for missing translations in UI text
const checkForMissingTranslationsInUI = (directories) => {
  const uiElementPattern = /<(?:div|span|p|h\d|Text)[^>]*>([^<>{}]+)<\/(?:div|span|p|h\d|Text)>/g;
  const meaningfulTextPattern = /\w+/;
  const missingTranslations = [];

  directories.forEach((directory) => {
    const files = globSync(`${directory}/**/*{.js,.jsx,.ts,.tsx}`);
    files.forEach((file) => {
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, i) => {
        const matches = [...line.matchAll(uiElementPattern)];
        matches.forEach((match) => {
          const textContent = match[1].trim();
          if (
            textContent &&
            meaningfulTextPattern.test(textContent) &&
            !/\b(?:t\(['"]|translate\(['"]|i18n\(['"])\b/.test(textContent)
          ) {
            missingTranslations.push({ file: file, line: i + 1, text: textContent });
          }
        });
      });
    });
  });

  return missingTranslations;
};

// Main function to analyze translations
const analyzeTranslations = async () => {
  const spinner = ora({
    spinner: {
      frames: ['◰', '◳', '◲', '◱']
    },
    color: 'blue'
  });

  console.log(chalk.blue.bold('\nAppCheck Translation Analysis'));

  spinner.start('Loading configuration');
  const configPath = path.join(process.cwd(), 'appcheck.config.json');
  if (!fs.existsSync(configPath)) {
    spinner.fail(chalk.red('Configuration not found. Please run "appcheck init" first.'));
    return;
  }

  const config = fs.readJsonSync(configPath);
  const { translationDir, apiEndpoint, languageCodeFormat, languages, projectDirs, translationFunction, languageMapping } = config;

  if (!Array.isArray(projectDirs)) {
    spinner.fail(chalk.red('Invalid configuration: projectDirs should be an array.'));
    return;
  }

  spinner.succeed(chalk.green('Configuration loaded successfully'));

  const ignoreConfig = loadAppCheckIgnore();
  if (Object.keys(ignoreConfig).length > 0) {
    console.log(chalk.yellow('.appcheckignore found and applied.'));
  } else {
    console.log(chalk.yellow('.appcheckignore not found, continuing without restrictions.'));
  }

  console.log(chalk.yellow('\nAnalysis Configuration:'));
  console.log(chalk.yellow(`• Translation Source: ${apiEndpoint ? 'API' : 'Local Files'}`));
  console.log(chalk.yellow(`• Translation Directory: ${translationDir || 'N/A'}`));
  console.log(chalk.yellow(`• Languages to check: ${languages.join(', ')}`));
  console.log(chalk.yellow(`• Project directories: ${projectDirs.join(', ')}`));

  const logFilePath = path.join(process.cwd(), 'translation_check.log');
  fs.writeFileSync(logFilePath, `AppCheck Translation Analysis Log\n\n`);

  const allKeys = new Set();
  const languageSummary = {};
  const processedLanguages = new Set();
  const detectedLanguages = new Set();

  const detectedFiles = globSync(`${translationDir}/**/*.json`);
  detectedFiles.forEach((file) => {
    const detectedLanguage = path.basename(file).split('.')[0];
    detectedLanguages.add(detectedLanguage);
  });

  detectedLanguages.forEach((detectedLang) => {
    if (!languages.includes(detectedLang)) {
      console.log(chalk.red(`⚠ Detected language "${detectedLang}" in ${translationDir} but it is not configured in appcheck.config.json`));
    }
  });

  for (const language of languages) {
    spinner.start(`Processing language: ${language}`);
    let translations = {};
    let keys = [];
    let translationFileFound = false;
    let duplicateDetails = [];

    const formattedLanguage = apiEndpoint
      ? formatLanguageCodeForAPI(language, languageCodeFormat, languageMapping)
      : language;

    if (apiEndpoint) {
      try {
        translations = await fetchTranslationsFromAPI(apiEndpoint, formattedLanguage);
        translationFileFound = true;

        duplicateDetails = checkForDuplicateValues(translations);
        if (duplicateDetails.length > 0) {
          const duplicateLog = [`\nDuplicate values found in ${language} API translations:\n---------------------------------------------------------------`];
          duplicateDetails.forEach(({ value, keys }) => {
            duplicateLog.push(`  • Value: "${value}"`);
            keys.forEach((key) => {
              duplicateLog.push(`    - Key: "${key}"`);
            });
          });
          fs.appendFileSync(logFilePath, duplicateLog.join('\n') + '\n');
        }
      } catch (error) {
        spinner.warn(chalk.yellow(`Error fetching translations for ${language}: ${error.message}`));
        continue;
      }
    } else if (translationDir) {
      try {
        translations = loadTranslationsFromDir(translationDir, language);
        if (Object.keys(translations).length === 0) {
          spinner.warn(chalk.yellow(`No translation files found for ${language}`));
          continue;
        }
        translationFileFound = true;

        duplicateDetails = checkForDuplicateValues(translations);
        if (duplicateDetails.length > 0) {
          const duplicateLog = [`\nDuplicate values found in ${language} local translations:\n---------------------------------------------------------------`];
          duplicateDetails.forEach(({ value, keys }) => {
            duplicateLog.push(`  • Value: "${value}"`);
            keys.forEach((key) => {
              duplicateLog.push(`    - Key: "${key}"`);
            });
          });
          fs.appendFileSync(logFilePath, duplicateLog.join('\n') + '\n');
        }
      } catch (error) {
        spinner.warn(chalk.yellow(`Error loading translations for ${language}: ${error.message}`));
        continue;
      }
    } else {
      spinner.warn(chalk.yellow(`No translation source specified for ${language}`));
      continue;
    }

    keys = findTranslationKeys(translations, ignoreConfig);
    if (keys.length > 0) {
      keys.forEach((key) => allKeys.add(key));
      languageSummary[language] = {
        totalKeys: keys,
        usedKeys: new Set(),
        unusedKeys: new Set(),
        duplicateCount: duplicateDetails.length,
      };
      processedLanguages.add(language);
      spinner.succeed(chalk.green(`Processed ${language}: Found ${keys.length} keys`));
    } else {
      spinner.warn(chalk.yellow(`No keys found for ${language}`));
    }
  }

  spinner.start('Analyzing translation usage');
  const { usedKeys, unusedKeys } = checkTranslationUsage(projectDirs, [...allKeys], translationFunction);
  spinner.succeed(chalk.green('Translation usage analysis complete'));

  for (const language of processedLanguages) {
    if (languageSummary[language]) {
      const langKeys = languageSummary[language].totalKeys;
      languageSummary[language].usedKeys = new Set([...usedKeys].filter((key) => langKeys.includes(key)));
      languageSummary[language].unusedKeys = new Set([...langKeys].filter((key) => !usedKeys.has(key)));
    }
  }

  spinner.start('Checking for missing translations in UI');
  const missingTranslations = checkForMissingTranslationsInUI(projectDirs);
  if (missingTranslations.length > 0) {
    const missingLog = [`\nMissing Translations in UI:\n---------------------------------------------------------------`];
    missingTranslations.forEach(({ file, line, text }) => {
      missingLog.push(`• ${file}, Line ${line}: "${text}"`);
    });
    fs.appendFileSync(logFilePath, missingLog.join('\n') + '\n');
  }
  spinner.succeed(chalk.green('UI translation check complete'));

  console.log(chalk.blue.bold('\nAnalysis Results'));
  console.log(chalk.green(`• Total unique translation keys: ${allKeys.size}`));
  console.log(chalk.green(`• Used translation keys: ${usedKeys.size}`));
  console.log(chalk.yellow(`• Unused translation keys: ${unusedKeys.size}`));

  if (unusedKeys.size > 0) {
    console.log(chalk.yellow(`• Unused keys are logged in ${logFilePath}`));
    const unusedLog = [`\nUnused translation keys:\n---------------------------------------------------------------`];
    [...unusedKeys].forEach((key) => unusedLog.push(`  • ${key}`));
    fs.appendFileSync(logFilePath, unusedLog.join('\n') + '\n');
  }

  console.log(chalk.blue.bold('\nLanguage Summary'));
  Object.entries(languageSummary).forEach(([lang, summary]) => {
    const usagePercentage = summary.totalKeys.length > 0 ? (summary.usedKeys.size / summary.totalKeys.length * 100).toFixed(2) : 0;
    const color = usagePercentage > 80 ? chalk.green : usagePercentage > 50 ? chalk.yellow : chalk.red;
    console.log(color(`• ${lang.toUpperCase()}:`));
    console.log(color(`  - Translation Keys: ${summary.totalKeys.length}`));
    console.log(color(`  - Used Keys: ${summary.usedKeys.size}`));
    console.log(color(`  - Unused Keys: ${summary.unusedKeys.size}`));
    console.log(color(`  - Duplicate Values: ${summary.duplicateCount}`));
    console.log(color(`  - Usage: ${usagePercentage}%`));
  });

  console.log(chalk.blue.bold(`\nDetailed results are written to ${logFilePath}.`));
  console.log(chalk.blue.bold('This log file contains:'));
  console.log(chalk.blue(`  • Lists of duplicate translation values found.`));
  console.log(chalk.blue(`  • All unused translation keys.`));
  console.log(chalk.blue(`  • Missing translations detected in UI files.`));
  console.log(chalk.blue.bold('\nAnalysis Complete'));
};

export { analyzeTranslations };
