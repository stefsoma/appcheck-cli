import fs from 'fs-extra';
import path from 'path';
const glob = (await import('glob')).glob;
import { findUsedFiles, findUnusedFiles, getAllFiles } from './fileUtils.js';

// Load translations from a JSON file
const loadTranslations = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Translation file not found: ${filePath}`);
  }
  return fs.readJsonSync(filePath);
};

// Find all translation keys in a loaded JSON object
const findTranslationKeys = (translations, prefix = '') => {
  let keys = [];
  for (const [key, value] of Object.entries(translations)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object') {
      keys = keys.concat(findTranslationKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
};

// Check if the translation keys are used in project files
const checkTranslationUsage = (directories, translationKeys) => {
  const usedKeys = new Set();
  const unusedKeys = new Set(translationKeys);
  const fileExtensions = ['.js', '.jsx', '.ts', '.tsx'];

  directories.forEach((directory) => {
    const files = glob.sync(`${directory}/**/*{${fileExtensions.join(',')}}`);
    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      translationKeys.forEach((key) => {
        const pattern = new RegExp(`t\\(['"]${key}['"]\\)`, 'g');
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
    const files = glob.sync(`${directory}/**/*{.js,.jsx,.ts,.tsx}`);
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

// Analyze translations
export const analyzeTranslations = () => {
  const configPath = path.join(process.cwd(), 'appcheck.config.json');
  if (!fs.existsSync(configPath)) {
    console.error('Configuration not found. Please run "appcheck init" first.');
    return;
  }

  const config = fs.readJsonSync(configPath);
  const { translationDir, projectDirs, translationFunction } = config;

  if (!Array.isArray(projectDirs)) {
    console.error('Invalid configuration: projectDirs should be an array.');
    return;
  }

  const translationFiles = glob.sync(`${translationDir}/**/*.json`);
  const allKeys = new Set();

  translationFiles.forEach((file) => {
    const translations = loadTranslations(file);
    const keys = findTranslationKeys(translations);
    keys.forEach((key) => allKeys.add(key));
  });

  const { usedKeys, unusedKeys } = checkTranslationUsage(projectDirs, [...allKeys]);

  console.log(`Total translation keys: ${allKeys.size}`);
  console.log(`Used translation keys: ${usedKeys.size}`);
  console.log(`Unused translation keys: ${unusedKeys.size}`);

  console.log('\nUnused keys:');
  unusedKeys.forEach((key) => console.log(`  ${key}`));

  const missingTranslations = checkForMissingTranslationsInUI(projectDirs);

  if (missingTranslations.length > 0) {
    console.log('\nMissing translation function in the following UI texts:');
    missingTranslations.forEach(({ file, line, text }) => {
      console.log(`  ${file}, Line ${line}: ${text}`);
    });
  }
};
