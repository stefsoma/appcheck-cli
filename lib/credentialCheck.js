import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';
import chalk from 'chalk';
import { createSpinner } from './customSpinner.js';

const loadAppCheckIgnore = () => {
    const ignoreFilePath = path.resolve(process.cwd(), '.appcheckignore');
    const ignoreConfig = {
        files: [],
        directories: []
    };

    if (fs.existsSync(ignoreFilePath)) {
        const ignoreContent = fs.readFileSync(ignoreFilePath, 'utf-8');
        let currentSection = null;

        ignoreContent.split('\n').forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;

            if (line === 'files:') {
                currentSection = 'files';
            } else if (line === 'directories:') {
                currentSection = 'directories';
            } else if (currentSection) {
                ignoreConfig[currentSection].push(line);
            }
        });
    }

    return ignoreConfig;
};

const shouldIgnore = (filePath, ignoreConfig) => {
    const { files, directories } = ignoreConfig;
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

    if (files.includes(path.basename(filePath))) {
        return true;
    }

    return directories.some(dir => relativePath.startsWith(dir));
};

const checkCredentials = async (config) => {
  const spinner = createSpinner();

  console.log(chalk.blue.bold('\nAppCheck Credential Analysis'));

  spinner.start('Initializing credential check');
  await new Promise(resolve => setTimeout(resolve, 1000));
  spinner.succeed('Credential check initialized');

  spinner.start('Loading ignore patterns');
  const ignoreConfig = loadAppCheckIgnore();
  if (fs.existsSync(path.resolve(process.cwd(), '.appcheckignore'))) {
    spinner.update('Loading ignore patterns (.appcheckignore found)');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  spinner.succeed('Ignore patterns loaded');

  spinner.start('Preparing to scan project files');
  await new Promise(resolve => setTimeout(resolve, 1000));
  spinner.succeed('Preparation complete');

  spinner.start('Analyzing project files for credentials');

  const credentialPatterns = [
    // API keys, tokens, and secrets
    /(?:api|access|auth|client)(?:[-_]?key|[-_]?token|[-_]?secret|[-_]?id)[\s]*[=:][\s]*['"]?[\w\d-._]+['"]?/i,
    
    // Passwords
    /(?:password|pwd)[\s]*[=:][\s]*['"][\w\d-]+['"]/i,
    
    // Connection strings
    /(?:connection|conn)(?:[-_]?string|[-_]?url)[\s]*[=:][\s]*['"]?[\w\d:/@.-]+['"]?/i,
    
    // Endpoints and URLs
    /(?:endpoint|url|uri)[\s]*[=:][\s]*['"]?https?:\/\/[\w\d.-/]+['"]?/i,
    
    // Firebase config
    /firebase(?:Config|AppConfig)[\s]*[=:][\s]*{[\s\S]*?}/i,
    
    // AWS
    /aws.*(?:access|secret).*key[\s]*[=:][\s]*['"][\w\d-]+['"]/i,
    
    // Azure
    /azure.*(?:connection|account).*(?:string|key)[\s]*[=:][\s]*['"][\w\d-]+['"]/i,
    
    // Supabase
    /supabase.*(?:url|key|anon|service_role)[\s]*[=:][\s]*['"][\w\d-]+['"]/i,
    
    // MongoDB
    /mongodb(?:\+srv)?:\/\/[\w\d:@.-/]+/i,
    
    // Google Cloud
    /google.*(?:application|project).*credentials[\s]*[=:][\s]*['"][\w\d-._]+['"]/i,
    
    // Stripe
    /stripe.*(?:publishable|secret).*key[\s]*[=:][\s]*['"][\w\d-]+['"]/i,
    
    // SendGrid
    /sendgrid.*api.*key[\s]*[=:][\s]*['"][\w\d-]+['"]/i,
    
    // Twilio
    /twilio.*(?:account|auth).*(?:sid|token)[\s]*[=:][\s]*['"][\w\d-]+['"]/i,
    
    // Fallback patterns (catching hardcoded values after ||)
    /process\.env\.[A-Z_]+\s*\|\|\s*['"][\w\d-._]+['"]/,

    // Generic environment variable pattern for .env files
    /^[\w\d_]+[\s]*=[\s]*['"]?[\w\d-._:/]+['"]?$/m
  ];

  const envFiles = ['.env', '.env.local', '.env.development', '.env.production', '.env_dev', '.env_prod'];
  const results = {
    suspiciousFiles: {},
    envFiles: [],
    errors: [],
    configReferences: {},
  };

  const checkFile = (filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const suspiciousLines = new Map();
      const configRefs = new Map();

      lines.forEach((line, index) => {
        const configMatch = line.match(/(?<service>\w+)\.config\(\)\.(?<key>[\w.]+)/);
        if (configMatch) {
          configRefs.set(index + 1, `${configMatch.groups.service}.config().${configMatch.groups.key}`);
          return;
        }

        credentialPatterns.some((pattern) => {
          const match = pattern.exec(line);
          if (match) {
            let maskedLine = line.replace(/(['"]?[\w\d-._:/]+['"]?)(?=\s*$)/, '"********"');
            suspiciousLines.set(index + 1, maskedLine.trim());
            return true;  // Stop after first match to avoid duplicates
          }
          return false;
        });
      });

      if (suspiciousLines.size > 0) {
        results.suspiciousFiles[filePath] = Array.from(suspiciousLines, ([lineNumber, content]) => ({ lineNumber, content }));
      }
      if (configRefs.size > 0) {
        results.configReferences[filePath] = Array.from(configRefs, ([lineNumber, content]) => ({ lineNumber, content }));
      }
    } catch (error) {
      results.errors.push({
        filePath,
        error: error.message
      });
    }
  };

  const checkDirectory = (directory) => {
    try {
      const files = globSync(`${directory}/**/*.*`, { 
        ignore: ['**/node_modules/**', '**/build/**', '**/dist/**', '**/.git/**'],
        nodir: true,
        dot: true  // Include dot files to catch .env files
      });
      files.forEach((file) => {
        if (!shouldIgnore(file, ignoreConfig)) {
          const basename = path.basename(file);
          if (envFiles.includes(basename) && !results.envFiles.includes(file)) {
            results.envFiles.push(file);
          }
          checkFile(file);
        }
      });
    } catch (error) {
      results.errors.push({
        directory,
        error: error.message
      });
    }
  };

  // Check the root directory
  const rootDir = process.cwd();
  checkDirectory(rootDir);

  spinner.succeed('Credential analysis complete');

  spinner.start('Generating report');
  await new Promise(resolve => setTimeout(resolve, 1000));
  spinner.succeed('Report generated');

  // Output the results
  console.log(chalk.blue.bold('\nAppCheck Credential Analysis Results'));

  if (results.envFiles.length > 0) {
    console.log(chalk.green('\nDetected .env files:'));
    results.envFiles.forEach((file) => {
      console.log(chalk.green(`  • ${file}`));
    });
  }

  if (Object.keys(results.suspiciousFiles).length > 0) {
    console.log(chalk.yellow('\nFiles with potential credentials:'));
    for (const [filePath, lines] of Object.entries(results.suspiciousFiles)) {
      console.log(chalk.yellow(`  • ${filePath}`));
      lines.forEach(({ lineNumber, content }) => {
        console.log(chalk.gray(`    Line ${lineNumber}: ${content}`));
      });
    }
  }

  if (Object.keys(results.configReferences).length > 0) {
    console.log(chalk.blue('\nDetected cloud configuration references:'));
    for (const [filePath, lines] of Object.entries(results.configReferences)) {
      console.log(chalk.blue(`  • ${filePath}`));
      lines.forEach(({ lineNumber, content }) => {
        console.log(chalk.gray(`    Line ${lineNumber}: ${content}`));
      });
    }
    console.log(chalk.blue('These references to cloud configurations are generally safe and not considered exposed secrets.'));
  }

  if (results.errors.length > 0) {
    console.log(chalk.red('\nErrors encountered during analysis:'));
    results.errors.forEach(({ filePath, directory, error }) => {
      if (filePath) {
        console.log(chalk.red(`  • Error in file ${filePath}: ${error}`));
      } else if (directory) {
        console.log(chalk.red(`  • Error in directory ${directory}: ${error}`));
      }
    });
  }

  if (Object.keys(results.suspiciousFiles).length > 0) {
    console.log(chalk.red.bold('\nSecurity Reminder:'));
    console.log(chalk.red('Files containing secrets or sensitive information should not be committed to version control.'));
    console.log(chalk.red('Consider adding the following files to your .gitignore, .npmignore, or other relevant ignore files:'));
    Object.keys(results.suspiciousFiles).forEach((file) => {
      console.log(chalk.red(`  • ${file}`));
    });
    console.log(chalk.red('For cloud or hosting services, ensure these files are also added to the appropriate ignore configurations.'));
  }

  console.log(chalk.blue.bold('\nCredential Check Complete'));
  console.log(chalk.yellow('Note: This check identifies potential credentials based on patterns. Please review the results manually for accuracy.'));
};

export { checkCredentials };