// fileUtils.js
import fs from 'fs-extra';
import path from 'path';

// Function to get all files from directories
const getAllFiles = (directories) => {
  if (!Array.isArray(directories)) {
    throw new Error('Expected directories to be an array.');
  }

  let allFiles = [];
  directories.forEach((directory) => {
    if (!fs.existsSync(directory)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }

    const files = fs.readdirSync(directory);
    files.forEach((file) => {
      const fullPath = path.join(directory, file);
      const stat = fs.lstatSync(fullPath);
      if (stat.isDirectory()) {
        allFiles = allFiles.concat(getAllFiles([fullPath])); // Recursively process directories
      } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
        allFiles.push(fullPath);
      }
    });
  });
  return allFiles;
};

// Function to find used files from all files
export const findUsedFiles = (allFiles) => {
  const usedFiles = new Set();
  const importPattern = /(?:import .* from\s+['"](.+)['"])|(?:require\(['"](.+)['"]\))/g;

  allFiles.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      const importedFile = match[1] || match[2];
      const importedFilePath = path.resolve(path.dirname(file), importedFile);
      usedFiles.add(importedFilePath);
    }
  });

  return usedFiles;
};

// Function to find unused files from all files and used files
export const findUnusedFiles = (allFiles, usedFiles) => {
  return allFiles.filter(file => !usedFiles.has(file));
};

// Function to analyze file statistics
export const analyzeFiles = (allFiles) => {
  return allFiles.map((file) => {
    const stats = fs.statSync(file);
    const sizeInBytes = stats.size;
    const numberOfLines = fs.readFileSync(file, 'utf-8').split('\n').length;
    return {
      file,
      sizeInBytes,
      numberOfLines
    };
  });
};

export { getAllFiles };
