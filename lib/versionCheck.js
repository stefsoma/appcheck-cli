import fetch from 'node-fetch';
import chalk from 'chalk';

export const notifyVersionUpdate = async (packageName, currentVersion) => {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const data = await response.json();
    const latestVersion = data['dist-tags'].latest;

    if (latestVersion !== currentVersion) {
      return chalk.yellow(`Update available for ${packageName}: ${currentVersion} → ${latestVersion}\nRun 'npm install -g ${packageName}' to update.`);
    } else {
      return null; // Return null if no update is needed
    }
  } catch (error) {
    return chalk.red('Failed to check for updates: ' + error.message);
  }
};
