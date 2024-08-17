
# AppCheck CLI Tool

[![App-Check-logo.png](https://i.postimg.cc/NMWLCxWX/App-Check-logo.png)](https://postimg.cc/47QJmp44) <!-- Replace this URL with the actual URL of your logo -->

AppCheck is a command-line tool designed to help developers manage and maintain JavaScript/TypeScript projects. It provides features to check for unused files, unused or missing translation keys, unused styling, and unused functions, helping to keep your project clean and efficient.

## Features

- **File Usage Analysis:** Lists all used and unused files, including the number of lines of code and file sizes.
- **Translation Key Check:** Identifies unused or missing translation keys across your project. You can configure this to check translations from an API by setting an `apiEndpoint` in the configuration or from local files if the `apiEndpoint` is not configured. Or check translation files stored locally in e.g. ./locales.
- **Styling Analysis:** Detects unused styling within your project.
- **Function Analysis:** Identifies unused functions to help clean up your codebase.

## Installation

Install the AppCheck CLI tool globally via npm:

```bash
npm install -g appcheck-cli
```

## Usage

### 1. Initialize Configuration

Start by setting up the configuration for your project.

```bash
appcheck init
```

Follow the prompts to specify:

- **Directory for Translation Files:** Specify the directory where your translation JSON files are stored.
- **Project File Directories:** Enter the directories in your project where source code files are stored.
- **Translation Function Name:** Enter the function name used in your code for handling translations (e.g., `t`, `translate`, `i18n`).
- **Language Code Format:** Choose the format for language codes (e.g., `en_US`).
- **Language Mappings:** Optionally map language codes to different formats (e.g., mapping `no` to `nb_NO`).

Example `appcheck.config.json`:

```json
{
  "translationDir": "./locales",
  "projectDirs": [
    "./app",
    "./components",
    "./context"
  ],
  "translationFunction": "t",
  "languageCodeFormat": "en_US",
  "languages": [
    "en",
    "es",
    "fr",
    "de",
    "no",
    "ru",
    "hu",
    "ch",
    "pl",
    "it",
    "pt"
  ],
  "apiEndpoint": "https://tpsprod.azurewebsites.net/api/translation/translations/",
  "configureMappings": true,
  "languageMapping": [
    {
      "language": "en",
      "mappings": [
        "en_US"
      ]
    },
    {
      "language": "no",
      "mappings": [
        "nb_NO"
      ]
    }
  ]
}
```

### 2. Check Files

Analyze your project to find all used and unused files.

```bash
appcheck check-files
```

Example Output:

```bash
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
```

### 3. Check Translations

Identify any unused or missing translation keys in your project.

#### Using API

If the `apiEndpoint` is configured in your `appcheck.config.json`, the translation check will fetch translations from the API based on the configured language codes and mappings.

```bash
appcheck check-translations
```

The tool will fetch translations using the provided API endpoint and the `languageMapping` specified. It will compare the translation keys fetched from the API with those used in the project directories. If the `apiEndpoint` is configured, the tool will not scan local files unless the `apiEndpoint` is removed from the configuration.

#### Using Local Files

If no `apiEndpoint` is configured, the tool will look for translation files in the `translationDir` directory. It will use the language codes directly as specified in the configuration.

```bash
appcheck check-translations
```

Example Output:

```bash
AppCheck Translation Analysis
✔ Configuration loaded successfully

Analysis Configuration:
• Translation Source: Local Files
• Translation Directory: ./locales
• Languages to check: en, es, fr, de, no, nb, ru, hu, ch, pl, it, pt
• Project directories: ./app, ./components, ./context
✔ Processed en: Found 286 keys
✔ Processed nb: Found 286 keys
⚠ No translation file found for es
⚠ No translation file found for fr
⚠ No translation file found for de
⚠ No translation file found for no
⚠ No translation file found for ru
⚠ No translation file found for hu
⚠ No translation file found for ch
⚠ No translation file found for pl
⚠ No translation file found for it
⚠ No translation file found for pt
✔ Translation usage analysis complete
✔ UI translation check complete

Analysis Results
• Total unique translation keys: 286
• Used translation keys: 243
• Unused translation keys: 43

Language Summary
• EN:
  - Translation Keys: 286
  - Used Keys: 243
  - Unused Keys: 43
  - Usage: 84.97%
• NB:
  - Translation Keys: 286
  - Used Keys: 243
  - Unused Keys: 43
  - Usage: 84.97%

Detailed results are written to translation_check.log.
```

### 4. Check Styling

Detect and report any unused styles in your project.

```bash
appcheck check-styling
```

Example Output:

```bash
Unused styles:
  headerStyle
  footerStyle
```

### 5. Check Functions

Identify and list any unused functions within your project.

```bash
appcheck check-functions
```

Example Output:

```bash
Unused functions:
  calculateTotal
  renderSidebar
```

### 6. Help

Get a list of all available commands and their descriptions.

```bash
appcheck help
```

Example Output:

```bash
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
```

### .appcheckignore

You can create a `.appcheckignore` file to specify keys, key prefixes, suffixes, or types of values (like dates, times, or key values containing numbers) that should be ignored during the translation check. This file should be placed in the root directory of your project.

Example `.appcheckignore`:

```
# Ignore specific keys
specific.key.to.ignore
another.key.to.ignore

# Ignore keys with a specific prefix or suffix
prefix*
*suffix

# Ignore keys containing numbers
*\d+*

# Ignore specific types of values (e.g., dates or times)
*\d{4}-\d{2}-\d{2}*
*\d{2}:\d{2}:\d{2}*
```

### Translation Check Log

Results from the translation check, including unused keys, missing translations, and duplicates, are written to a `translation_check.log` file in the root directory. This file provides detailed information about the check, including where each issue was found.

Example contents of `translation_check.log`:

```plaintext
---------------------------------------------------------------
Unused translation keys:
---------------------------------------------------------------
  home.title
  about.description
...

---------------------------------------------------------------
Missing Translations in UI:
---------------------------------------------------------------
• app\(auth)\signup.js, Line 50: "Create Account"
...

---------------------------------------------------------------
Duplicate values found in en translations:
---------------------------------------------------------------
  • Value: "Success"
    - Key: "settings.success" in file "locales\en.json" at line 6
    - Key: "events.success" in file "locales\en.json" at line 6
...
```

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
