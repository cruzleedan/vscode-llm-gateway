# Adding an Icon

## Requirements

- **Size**: 256x256 or 512x512 pixels (minimum 128x128)
- **Format**: PNG
- **File name**: `icon.png` (place in root directory)
- **Content**: Should be recognizable at small sizes
- **Background**: Transparent or solid color

## Quick Options

### Option 1: Create with Design Tool
Use Figma, Canva, or any image editor to create a 512x512 PNG with:
- A gateway/bridge icon
- Network/connection symbol
- LLM/AI related imagery

### Option 2: Generate with AI
Prompt: "Create a 512x512 icon for a VS Code extension that connects to LLM gateways. Modern, flat design with blue and purple gradient. Transparent background."

### Option 3: Use Icon Fonts
1. Go to https://icones.js.org/
2. Search for "gateway", "network", or "connection"
3. Download as 512x512 PNG
4. Save as `icon.png` in root

## Add to package.json

Once you have `icon.png` in the root directory:

```json
{
  "icon": "icon.png",
  ...
}
```

## Rebuild and Republish

```bash
npm run compile
npx vsce package
# Check the .vsix file includes the icon
code --install-extension llm-gateway-connector-0.1.0.vsix
```

The icon will appear in:
- VS Code Extensions panel
- Marketplace listing
- Extension details page
