import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';
import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';

// Helper function to format language code for API
const formatLanguageCodeForAPI = (language, format, languageMapping) => {
  const mappingEntry = languageMapping.find(mapping => mapping.language === language);
  let mappedLanguage = mappingEntry && mappingEntry.mappings[0] ? mappingEntry.mappings[0] : language;

  if (format === 'en_US') {
    return mappedLanguage.includes('_') ? mappedLanguage : `${mappedLanguage}_${mappedLanguage.toUpperCase()}`;
  }
  
  return mappedLanguage;
};

// Load translations from a JSON file
const loadTranslations = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Translation file not found: ${filePath}`);
  }
  return fs.readJsonSync(filePath);
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

    const [section, value] = line.split(':').map(item => item.trim());
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
const shouldIgnore = (key, value, ignoreConfig) => {
  const { keys, prefixes, suffixes, patterns, keysWithNumbers } = ignoreConfig;

  // Check keys
  if (keys && keys.some(ignoredKey => key === ignoredKey || ignoredKey.endsWith('*') && key.startsWith(ignoredKey.slice(0, -1)))) {
    return true;
  }

  // Check prefixes
  if (prefixes && prefixes.some(prefix => key.startsWith(prefix))) {
    return true;
  }

  // Check suffixes
  if (suffixes && suffixes.some(suffix => key.endsWith(suffix))) {
    return true;
  }

  // Check value patterns (regex)
  if (patterns && patterns.some(pattern => new RegExp(pattern).test(value))) {
    return true;
  }

  // Check if the key contains numbers
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

  if (Array.isArray(translations)) {
    translations.forEach(item => {
      if (item.translationCode) {
        keys.add(item.translationCode);
      }
    });
  } else if (typeof translations === 'object' && translations !== null) {
    traverse(translations);
  } else {
    console.error(chalk.red('Unexpected data format for translations:', typeof translations));
  }

  return [...keys];
};

// Check for duplicate translation values
const checkForDuplicateValues = (translations, source = 'API') => {
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
            source,
            lines: [valueMap.get(value).line, null], // No line info for API
          });
        } else {
          valueMap.set(value, { key: fullKey, line: null }); // No line info for API
        }
      }
    }
  };

  traverse(translations);

  return duplicateDetails;
};

// Helper function to get the line number of a key in the file
const getLineNumber = (filePath, key) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const regex = new RegExp(`"${key.split('.').pop()}":\\s*`);
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      return i + 1; // Line numbers are 1-based
    }
  }
  return null;
};

// Check if the translation keys are used in project files
const checkTranslationUsage = (directories, translationKeys, translationFunction) => {
  const usedKeys = new Set();
  const unusedKeys = new Set(translationKeys);
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
          unusedKeys.delete(key);
        }
      });
    });
  });

  return { usedKeys, unusedKeys };
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
  const spinner = ora({ // Use ora to create a spinner
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

  // Load .appcheckignore rules
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

  // Prepare log file
  const logFilePath = path.join(process.cwd(), 'translation_check.log');
  fs.writeFileSync(logFilePath, `AppCheck Translation Analysis Log\n\n`);

  const allKeys = new Set();
  const languageSummary = {};

  for (const language of languages) {
    spinner.start(`Processing language: ${language}`);
    let translations = {};
    let keys = [];
    let translationFile = null;

    // Format the language code for API only; use language as is for local files
    const formattedLanguage = apiEndpoint
      ? formatLanguageCodeForAPI(language, languageCodeFormat, languageMapping)
      : language;

    if (apiEndpoint) {
      try {
        translations = await fetchTranslationsFromAPI(apiEndpoint, formattedLanguage);
        translationFile = null; // Set translationFile to null since we're using API

        // Check for duplicates in API translations
        const duplicateDetails = checkForDuplicateValues(translations);
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
      // Define possible file patterns for local files using the language code directly
      const filePatterns = [
        path.join(translationDir, `${language}.json`),
        path.join(translationDir, language, 'translation.json'),
        path.join(translationDir, 'locales', `${language}.json`),
        path.join(translationDir, 'locales', language, 'translation.json')
      ];

      for (const pattern of filePatterns) {
        if (fs.existsSync(pattern)) {
          translationFile = pattern;
          break;
        }
      }

      if (!translationFile) {
        spinner.warn(chalk.yellow(`No translation file found for ${language}`));
        continue;
      }

      try {
        translations = loadTranslations(translationFile);

        // Check for duplicates in local file translations
        const duplicateDetails = checkForDuplicateValues(translations, translationFile);
        if (duplicateDetails.length > 0) {
          const duplicateLog = [`\nDuplicate values found in ${language} local translations:\n---------------------------------------------------------------`];
          duplicateDetails.forEach(({ value, keys, file, lines }) => {
            duplicateLog.push(`  • Value: "${value}"`);
            keys.forEach((key, index) => {
              duplicateLog.push(`    - Key: "${key}" in file "${file}" at line ${lines[index]}`);
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

    // Apply ignore rules before processing keys
    keys = findTranslationKeys(translations, ignoreConfig);
    keys.forEach((key) => allKeys.add(key));

    languageSummary[language] = {
      totalKeys: keys.length,
      usedKeys: new Set(),
      unusedKeys: new Set(),
      duplicateCount: checkForDuplicateValues(translations).length,
    };

    spinner.succeed(chalk.green(`Processed ${language}: Found ${keys.length} keys`));
  }

  spinner.start('Analyzing translation usage');
  const { usedKeys, unusedKeys } = checkTranslationUsage(projectDirs, [...allKeys], translationFunction);
  spinner.succeed(chalk.green('Translation usage analysis complete'));

  // Update language summaries with used and unused keys
  for (const language of languages) {
    if (languageSummary[language]) {
      const langKeys = languageSummary[language].keys || new Set();
      languageSummary[language].usedKeys = new Set([...usedKeys].filter(key => langKeys.has(key)));
      languageSummary[language].unusedKeys = new Set([...langKeys].filter(key => !usedKeys.has(key)));
    }
  }

  // Check for missing translations in UI
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

  // Print the detailed analysis
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

  // Print language summary
  console.log(chalk.blue.bold('\nLanguage Summary'));
  Object.entries(languageSummary).forEach(([lang, summary]) => {
    const usagePercentage = summary.totalKeys > 0 ? (summary.usedKeys.size / summary.totalKeys * 100).toFixed(2) : 0;
    const color = usagePercentage > 80 ? chalk.green : (usagePercentage > 50 ? chalk.yellow : chalk.red);
    console.log(color(`• ${lang.toUpperCase()}:`));
    console.log(color(`  - Translation Keys: ${summary.totalKeys}`));
    console.log(color(`  - Used Keys: ${summary.usedKeys.size}`));
    console.log(color(`  - Unused Keys: ${summary.unusedKeys.size}`));
    console.log(color(`  - Duplicate Values: ${summary.duplicateCount}`));  // Add duplicate count to summary
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
