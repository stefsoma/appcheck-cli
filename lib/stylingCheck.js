import fs from 'fs-extra';
import path from 'path';
import { getAllFiles } from './fileUtils.js';
import chalk from 'chalk';

// Main function to analyze styling
export const analyzeStyling = () => {
  const configPath = path.join(process.cwd(), 'appcheck.config.json');

  if (!fs.existsSync(configPath)) {
    console.error('Configuration not found. Please run "appcheck init" first.');
    return;
  }

  const config = fs.readJsonSync(configPath);
  const projectDirs = config.projectDirs;

  const allFiles = getAllFiles(projectDirs);
  const { unusedStyles, usedStylesInFiles } = findUnusedStyles(allFiles);

  if (unusedStyles.size > 0) {
    console.log(chalk.red('\nUnused styles:'));
    unusedStyles.forEach(({ style, file, line }) => {
      console.log(`File: ${file}, Line: ${line}, Style: ${style}`);
    });
  } else {
    console.log(chalk.green('\nNo unused styles found!'));
  }
};

// Function to find unused styles
const findUnusedStyles = (allFiles) => {
  const usedStyles = new Set();
  const unusedStyles = [];

  const stylePattern = /(\w+):\s*\{[^}]*\}/g;
  const styleDeclarationPattern = /const\s+(\w+)\s*=\s*StyleSheet.create\(\{([^}]*)\}\)/g;

  allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    let match;

    // Identify used styles
    while ((match = stylePattern.exec(content)) !== null) {
      const style = match[1];
      usedStyles.add(style);
    }

    // Identify declared styles and check if they are used
    while ((match = styleDeclarationPattern.exec(content)) !== null) {
      const stylesBlock = match[2];
      const styleLines = stylesBlock.split(',').map(line => line.trim());
      styleLines.forEach(styleLine => {
        const [styleName] = styleLine.split(':');
        if (!usedStyles.has(styleName.trim())) {
          const lineNumber = content.substring(0, match.index).split('\n').length;
          unusedStyles.push({ style: styleName.trim(), file, line: lineNumber });
        }
      });
    }
  });

  return { unusedStyles, usedStylesInFiles: usedStyles };
};
