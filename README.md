# Paynet Documentation Portal

A modern, multilingual API documentation portal built with React, TypeScript, and Tailwind CSS.

## Features

- **Dynamic OpenAPI Loading**: Automatically loads and parses OpenAPI specifications from the `src/openapi/` directory
- **Multi-language Support**: English, Romanian, and Russian translations
- **Interactive Documentation**: Browse endpoints, view parameters, responses, and code examples
- **Multiple Format Support**: Supports both JSON and YAML OpenAPI specifications
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Code Examples**: Generate code examples in multiple programming languages (cURL, JavaScript, Python, PHP, Java, C#)

## Adding New API Specifications

To add a new API specification:

1. Create a new file in the `src/openapi/` directory
2. Use either `.json`, `.yaml`, or `.yml` extension
3. Ensure the file contains a valid OpenAPI 3.0+ specification
4. The application will automatically detect and load the new specification

### Example file structure:
```
src/openapi/
├── tps.yaml          # Main TPS API specification
├── payments.json     # Additional payments API
└── users.yaml        # User management API
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## File Formats Supported

- **JSON**: Standard JSON format OpenAPI specifications
- **YAML**: YAML format OpenAPI specifications (recommended for readability)

## Automatic Features

- **Hot Reload**: Changes to OpenAPI files are automatically detected during development
- **Validation**: Invalid OpenAPI specifications are automatically filtered out with console warnings
- **Fallback**: If no valid specifications are found, the application falls back to the built-in sample data

## Project Structure

```
src/
├── openapi/          # OpenAPI specification files
├── components/       # React components
├── hooks/           # Custom React hooks
├── utils/           # Utility functions
├── locales/         # Translation files
├── data/            # Static data and fallback content
└── types/           # TypeScript type definitions
```