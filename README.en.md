<p align="center"><img src="icons/icon128.png" width="88" alt="Promi Prompt Butler" /></p>
<h1 align="center">Promi Prompt Butler</h1>
<p align="center">Turn ideas into prompts, prompts into images, and useful work into your own library.</p>
<p align="center"><a href="README.md">简体中文</a> · <strong>English</strong></p>
<p align="center">
  <a href="https://github.com/MianTiaoDW/promi-prompt-butler/releases"><img src="https://img.shields.io/badge/version-1.4.0-0467FB" alt="v1.4.0" /></a>
  <img src="https://img.shields.io/badge/Chrome%20%2F%20Edge-MV3-0467FB" alt="Chrome / Edge MV3" />
  <img src="https://img.shields.io/badge/Windows%20%2F%20macOS-supported-0467FB" alt="Windows / macOS" />
</p>
<p align="center"><a href="https://github.com/MianTiaoDW/promi-prompt-butler/releases">Download a test build</a> · <a href="docs/使用指南.md">User guide (Chinese)</a> · <a href="https://github.com/MianTiaoDW/promi-prompt-butler/issues">Report an issue</a></p>

Promi is a Chrome / Edge extension for AI art workflows. It brings prompt organization, AI prompt writing, and image generation into one workspace, with light, dark, and system themes.

The current sharing build is **v1.4.0**. Bring your own model provider and API key. The extension does not include model credits; supported models and image parameters depend on your provider. The interface and detailed user guide are currently in Chinese; this page provides an English introduction and setup instructions.

## Three workspaces

| Workspace | What it does |
| --- | --- |
| Prompt library (提示词库) | Search, create multi-step prompt groups, copy, edit, like, sort, organize folders, and export ZIP backups. |
| Create (创作) | Describe an idea, select an expert role, workflow, and model, then generate Chinese prompts, English prompts, and structured JSON. Edit, save, or send results to the image workspace. |
| Image workshop (图像工坊) | Edit an image prompt, choose aspect ratio, resolution, and count, then generate, cancel, preview, copy, download, and browse creation history. |

## Features

- **Emphasis (main development build):** select prompt text to apply background or text colors, with 10 reading presets, custom HSV / HEX, background opacity, theme previews, contrast warnings and a readability adjustment. Annotations persist separately; copy and model requests stay plain text. [Details and measurements (Chinese)](docs/PROMPT_EMPHASIS.md). Existing v1.4.0 release packages do not include this feature; build current main to use it.

- **Reference images:** add files or drag them into the creation area, up to 8 images in the received order.
- **Folders:** ten colors, drag sorting, and inline title editing by double-click. Removing a prompt from a folder only removes that association; the prompt remains in All. Deleting a folder keeps its prompts.
- **Example images:** up to 3 per prompt. Hover for the eye icon and click to enlarge. Use the corner X to delete an image or the button below it to choose the library card cover. Full-size previews support copying and downloading; JPEG / WebP images are converted to PNG for clipboard copying.
- **Import and backup:** import ZIP / JSON with append or replace. Append skips duplicates; replace asks for confirmation before replacing prompts and folders. ZIP exports include prompts, folders, ordering, and example images.
- **Creation history:** keeps the latest 50 images in the extension, newest first, across reopening. Generated images are also saved under `prompt-butler/创作历史` in the browser download directory; manual downloads go to `prompt-butler/下载图片`. Older images leave the extension list while local files remain.
- **Model settings:** configure text, vision, and image models, with optional separate image API credentials and endpoint. Presets include Claude, Gemini, OpenAI, Volcengine, Kimi, DeepSeek, and OpenAI-compatible relays. Provider rows link to official API platforms.
- **Guided onboarding:** follow or skip the first-run guide, then revisit any of six chapters through the book icon. Chapters can navigate between the main workspace and settings.
- **Visual feedback:** blue actions, light / dark themes, animated pink heart likes, and jelly illustrations for welcome, empty search, generation, and error states.

## Download and install

You do not need Node.js or a build tool to use a packaged release.

1. Open [Releases](https://github.com/MianTiaoDW/promi-prompt-butler/releases) and choose a release with a plugin ZIP attachment.
2. Download the **Promi test package ZIP** and extract it to a permanent location. GitHub's automatic `Source code` downloads are source archives, not ready-to-load extension packages.
3. Open `chrome://extensions/` in Chrome or `edge://extensions/` in Edge.
4. Enable Developer mode, click Load unpacked, and select the **`extension` folder** inside the extracted package.
5. Open Promi from the browser toolbar and follow the guide.

Keep the extracted folder in place. Before updating, export a prompt backup, copy the new `extension` contents into the original loaded directory, and click Reload. Keeping the original directory and extension ID preserves access to existing local extension data.

## First use

1. Open settings using the gear icon. Choose a provider; the API platform link opens its official site to register, choose models, and create a key.
2. Enter the API key, endpoint, and model IDs. Save the configuration and test the connection. An API console webpage URL is not the same as a Base URL.
3. In Create, describe an idea, add reference images, and choose an expert role and workflow before generating prompts.
4. Edit, copy, or save the result. Use Start creating (开始创作) to send it to the image workshop.

Organizing prompts does not require an AI request. Generation and AI optimization use your configured provider. The shared package contains no author credentials or personal browser data.

## Always-on-top workspace

| System | Setup |
| --- | --- |
| Windows | Optionally run `windows-pin/install.cmd` from the package and enter your own extension ID. Reload the extension and click the pin. No Node.js or .NET SDK is required. |
| macOS | Recent Chrome / Edge versions can open an interactive floating workspace with Document Picture-in-Picture. No Windows helper is required; the browser must support the API. |

On macOS, keep the original extension window open. Closing or refreshing it closes the floating workspace. Unsaved inputs are separate in each window; saved data shares the extension storage. Other main features work without always-on-top support.

## Local data

Prompts, folders, and settings live in the current browser extension's local storage. Example images use the extension's IndexedDB. Generated images are also saved to disk as described above.

GitHub syncs source code, not API keys, personal prompts, or browser history. Use ZIP export / import to move prompt data, and never post API keys or screenshots exposing them in Issues.

## Build from source

Requires Node.js and npm.

```bash
git clone https://github.com/MianTiaoDW/promi-prompt-butler.git
cd promi-prompt-butler
npm ci
npm run build
```

Load the generated **`dist` folder** from the extension manager. Use `npm run dev` for development and `npm run typecheck` for type checking. In PowerShell, `./scripts/package-test.ps1` creates a sharing package under the local `exports/` directory.

Stack: React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Framer Motion 12, and CRXJS / Manifest V3. AI requests are handled by the background Service Worker.

## Documentation and feedback

- [User guide (Chinese)](docs/使用指南.md).
- [v1.4.0 notes (Chinese)](docs/RELEASE_v1.4.0.md).
- [Documentation index](docs/README.md), [project structure](docs/PROJECT_STRUCTURE.md), and [development handoff](docs/CODEX_HANDOFF.md) (Chinese).
- [Report an issue](https://github.com/MianTiaoDW/promi-prompt-butler/issues): include your OS, browser, version, steps, and actual outcome. Hide credentials in screenshots.
- [Icon attribution and license](docs/ICONSAX_NOTICE.md).
