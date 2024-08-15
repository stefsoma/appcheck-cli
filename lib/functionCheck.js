import fs from 'fs-extra';
import path from 'path';
import { getAllFiles } from './fileUtils.js';
import chalk from 'chalk';

export const analyzeFunctions = () => {
  const configPath = path.join(process.cwd(), 'appcheck.config.json');

  if (!fs.existsSync(configPath)) {
    console.error('Configuration not found. Please run "appcheck init" first.');
    return;
  }

  const config = fs.readJsonSync(configPath);
  const projectDirs = config.projectDirs;

  const allFiles = getAllFiles(projectDirs);

  const unusedFunctions = findUnusedFunctions(allFiles);

  if (unusedFunctions.size > 0) {
    console.log(chalk.red('\nUnused functions:'));
    unusedFunctions.forEach(func => console.log(`  ${func}`));
  } else {
    console.log(chalk.green('\nNo unused functions found!'));
  }
};

const findUnusedFunctions = (allFiles) => {
  const usedFunctions = new Set();
  const unusedFunctions = new Set();

  const functionPattern = /function\s+(\w+)\s*\(/g;
  const callPattern = /(\w+)\s*\(/g;

  allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    let match;

    while ((match = functionPattern.exec(content)) !== null) {
      const func = match[1];
      unusedFunctions.add(func);
    }

    while ((match = callPattern.exec(content)) !== null) {
      const func = match[1];
      if (unusedFunctions.has(func)) {
        unusedFunctions.delete(func);
      }
      usedFunctions.add(func);
    }
  });

  return unusedFunctions;
};
