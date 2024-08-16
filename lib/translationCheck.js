import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';
import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora'; // Correctly import ora

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

// Find all translation keys in a loaded JSON object or API response
const findTranslationKeys = (translations) => {
  const keys = new Set();
  
  const traverse = (obj, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        traverse(value, fullKey);
      } else {
        keys.add(fullKey);
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

  console.log(chalk.yellow('\nAnalysis Configuration:'));
  console.log(chalk.yellow(`• Translation Source: ${apiEndpoint ? 'API' : 'Local Files'}`));
  console.log(chalk.yellow(`• Translation Directory: ${translationDir || 'N/A'}`));
  console.log(chalk.yellow(`• Languages to check: ${languages.join(', ')}`));
  console.log(chalk.yellow(`• Project directories: ${projectDirs.join(', ')}`));

  const allKeys = new Set();
  const languageSummary = {};

  for (const language of languages) {
    spinner.start(`Processing language: ${language}`);
    let translations = {};
    let keys = [];

    // Format the language code for API only; use language as is for local files
    const formattedLanguage = apiEndpoint
      ? formatLanguageCodeForAPI(language, languageCodeFormat, languageMapping)
      : language;

    if (apiEndpoint) {
      try {
        translations = await fetchTranslationsFromAPI(apiEndpoint, formattedLanguage);
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

      let translationFile = null;
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
      } catch (error) {
        spinner.warn(chalk.yellow(`Error loading translations for ${language}: ${error.message}`));
        continue;
      }
    } else {
      spinner.warn(chalk.yellow(`No translation source specified for ${language}`));
      continue;
    }

    keys = findTranslationKeys(translations);
    keys.forEach((key) => allKeys.add(key));

    languageSummary[language] = {
      totalKeys: keys.length,
      keys: new Set(keys),
    };

    spinner.succeed(chalk.green(`Processed ${language}: Found ${keys.length} keys`));
  }

  spinner.start('Analyzing translation usage');
  const { usedKeys, unusedKeys } = checkTranslationUsage(projectDirs, [...allKeys], translationFunction);
  spinner.succeed(chalk.green('Translation usage analysis complete'));

  // Update language summaries with used and unused keys
  for (const language of languages) {
    if (languageSummary[language]) {
      const langKeys = languageSummary[language].keys;
      languageSummary[language].usedKeys = new Set([...usedKeys].filter(key => langKeys.has(key)));
      languageSummary[language].unusedKeys = new Set([...langKeys].filter(key => !usedKeys.has(key)));
    }
  }

  spinner.start('Checking for missing translations in UI');
  const missingTranslations = checkForMissingTranslationsInUI(projectDirs);
  spinner.succeed(chalk.green('UI translation check complete'));

  // Print the detailed analysis
  console.log(chalk.blue.bold('\nAnalysis Results'));

  console.log(chalk.green(`• Total unique translation keys: ${allKeys.size}`));
  console.log(chalk.green(`• Used translation keys: ${usedKeys.size}`));
  console.log(chalk.yellow(`• Unused translation keys: ${unusedKeys.size}`));

  if (unusedKeys.size > 0) {
    console.log(chalk.yellow('\nSample of Unused Keys:'));
    [...unusedKeys].slice(0, 10).forEach((key) => console.log(chalk.yellow(`  • ${key}`)));
    if (unusedKeys.size > 10) {
      console.log(chalk.yellow(`  ... and ${unusedKeys.size - 10} more`));
    }
  }

  // Display all missing translations
  if (missingTranslations.length > 0) {
    console.log(chalk.red.bold('\nMissing Translations in UI'));
    missingTranslations.forEach(({ file, line, text }) => {
      console.log(chalk.red(`• ${file}, Line ${line}: "${text}"`));
    });
    console.log(chalk.red(`\nTotal missing translations: ${missingTranslations.length}`));
  } else {
    console.log(chalk.green('\nNo missing translations found in UI.'));
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
    console.log(color(`  - Usage: ${usagePercentage}%`));
  });

  console.log(chalk.blue.bold('\nAnalysis Complete'));
};

export { analyzeTranslations };
