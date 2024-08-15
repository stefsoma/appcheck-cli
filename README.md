# AppCheck CLI Tool

[![App-Check-logo.png](https://i.postimg.cc/NMWLCxWX/App-Check-logo.png)](https://postimg.cc/47QJmp44) <!-- Replace this URL with the actual URL of your logo -->

AppCheck is a command-line tool designed to help developers manage and maintain JavaScript/TypeScript projects. It provides features to check for unused files, unused or missing translation keys, unused styling, and unused functions, helping to keep your project clean and efficient.

## Features

- **File Usage Analysis:** Lists all used and unused files, including the number of lines of code and file sizes.
- **Translation Key Check:** Identifies unused or missing translation keys across your project.
- **Styling Analysis:** Detects unused styling within your project.
- **Function Analysis:** Identifies unused functions to help clean up your codebase.

## Installation

Install the AppCheck CLI tool globally via npm:

    npm install -g appcheck-cli

## Usage

### 1. Initialize Configuration

Start by setting up the configuration for your project.

    appcheck init

Follow the prompts to specify:

- **Directory for Translation Files:** Specify the directory where your translation JSON files are stored.
- **Project File Directories:** Enter the directories in your project where source code files are stored.
- **Translation Function Name:** Enter the function name used in your code for handling translations (e.g., `t`, `translate`, `i18n`).

### 2. Check Files

Analyze your project to find all used and unused files.

    appcheck check-files

Example Output:

    File Analysis:
    File: ./app/components/Header.js
      Size: 1024 bytes
      Lines: 45

    File: ./app/components/Footer.tsx
      Size: 2048 bytes
      Lines: 78

    File: ./app/views/Home.js
      Size: 512 bytes
      Lines: 20

    Total Number of Files: 3
    Total Number of Lines of Code: 143
    Total Size of Files: 3584 bytes (3.5 KB)

    Used files:
      ./app/components/Header.js
      ./app/components/Footer.tsx
      ./app/views/Home.js

    Unused files:
      ./app/components/Sidebar.jsx
      ./app/views/About.tsx

### 3. Check Translations

Identify any unused or missing translation keys in your project.

    appcheck check-translations

Example Output:

    Unused translation keys:
      home.title
      about.description

    Missing translation keys:
    In en.json:
      about.subtitle

    In es.json:
      home.title
      about.subtitle
      contact.form.label

### 4. Check Styling

Detect and report any unused styles in your project.

    appcheck check-styling

Example Output:

    Unused styles:
      headerStyle
      footerStyle

### 5. Check Functions

Identify and list any unused functions within your project.

    appcheck check-functions

Example Output:

    Unused functions:
      calculateTotal
      renderSidebar

### 6. Help

Get a list of all available commands and their descriptions.

    appcheck help

Example Output:

    AppCheck CLI Tool

    Available Commands:
      appcheck init
        Opens the tools menu to configure and check files.

      appcheck check-files
        Lists all used and unused files in the configured directories, including file size and lines of code.

      appcheck check-translations
        Checks for unused or missing translation keys.

      appcheck check-styling
        Checks for unused styling.

      appcheck check-functions
        Checks for unused functions.

      appcheck help
        Displays help information.

## Repository

- **GitHub Repository:** [stefsoma/appcheck-cli](https://github.com/stefsoma/appcheck-cli)
- **Issues:** [Submit an issue](https://github.com/stefsoma/appcheck-cli/issues)
- **License:** MIT

## Statistics

- **Weekly Downloads:** ![Weekly Downloads](https://img.shields.io/npm/dw/appcheck-cli) <!-- Badge for weekly downloads -->
- **Version:** ![Version](https://img.shields.io/npm/v/appcheck-cli) <!-- Badge for version -->

## Contributing

If you find a bug or have a feature request, feel free to submit an issue or a pull request on the GitHub repository.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
