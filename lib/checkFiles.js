// /lib/checkFiles.js
import fs from 'fs-extra';
import path from 'path';
import { sync as globSync } from 'glob';
import { getAllFiles, findUsedFiles, findUnusedFiles, analyzeFiles } from './fileUtils.js';

// Retrieve configuration from config file
const getConfig = () => {
  const configPath = path.join(process.cwd(), 'appcheck.config.json');
  if (fs.existsSync(configPath)) {
    return fs.readJsonSync(configPath);
  }
  return { projectDirs: ['./src'] }; // Default directory
};

// Retrieve all JavaScript/TypeScript files from specified directories
const getAllFilesFromDirs = (directories) => {
  if (!Array.isArray(directories)) {
    throw new Error('Expected directories to be an array.');
  }

  let allFiles = [];
  directories.forEach((directory) => {
    if (!fs.existsSync(directory)) {
      console.warn(`Directory does not exist: ${directory}`);
      return;
    }

    // Using glob to find files in a directory
    const files = globSync('**/*.{js,jsx,ts,tsx}', { cwd: directory, nodir: true });

    files.forEach((file) => {
      const fullPath = path.join(directory, file);
      allFiles.push(fullPath);
    });
  });
  return allFiles;
};

// Analyze files for usage and statistics
export const analyze = () => {
  try {
    const config = getConfig();
    const directories = config.projectDirs; // Read directories from config
    const allFiles = getAllFilesFromDirs(directories);
    const usedFiles = findUsedFiles(allFiles);
    const unusedFiles = findUnusedFiles(allFiles, usedFiles);

    // Analyze file details
    const fileAnalysis = analyzeFiles(allFiles);

    // Initialize totals
    let totalFiles = 0;
    let totalLines = 0;
    let totalSize = 0;

    console.log('File Analysis:');
    fileAnalysis.forEach(({ file, sizeInBytes, numberOfLines }) => {
      totalFiles += 1;
      totalLines += numberOfLines;
      totalSize += sizeInBytes;

      console.log(`File: ${file}`);
      console.log(`  Size: ${sizeInBytes} bytes`);
      console.log(`  Lines: ${numberOfLines}`);
    });

    // Print summary of totals
    console.log('\nSummary:');
    console.log(`Total Number of Files: ${totalFiles}`);
    console.log(`Total Number of Lines of Code: ${totalLines}`);
    console.log(`Total Size of Files: ${totalSize} bytes (${(totalSize / 1024).toFixed(2)} KB)`);

    console.log('\nAll Files:', allFiles);
    console.log('Used Files:', Array.from(usedFiles));
    console.log('Unused Files:', unusedFiles);
  } catch (error) {
    console.error('Error analyzing files:', error);
  }
};
