# Goose Analysis for VS Code

AI-powered code analysis and explanation using OpenAI GPT or Google Gemini.

## Features

- **Code Analysis**: Get detailed analysis of code quality, potential issues, and improvements
- **Code Explanation**: Understand complex code with AI-powered explanations
- **Multi-AI Support**: Choose between OpenAI (GPT-4, GPT-4o) or Google Gemini
- **Custom API Support**: Use your own OpenAI-compatible API endpoints
- **Caching**: Smart caching to reduce API calls and costs

## Usage

1. Open a supported file (TypeScript, JavaScript, Java, or Python)
2. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac) to open the Analysis panel
3. Click "Run Analysis" or "Run Explain" to get AI insights
4. Configure your AI provider in VS Code settings

## Configuration

Set your API keys in VS Code settings:
- `gooseAnalysis.aiProvider`: Choose "openai" or "gemini"
- `gooseAnalysis.openaiApiKey`: Your OpenAI API key
- `gooseAnalysis.geminiApiKey`: Your Gemini API key

For better security, use VS Code's Secret Storage instead of settings.

## Commands

- `Goose Analysis: Open Analysis Panel` - Open the AI analysis panel

## License

MIT
