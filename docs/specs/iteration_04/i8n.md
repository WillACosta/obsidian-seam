## Implement i8n to support both "English (US)" and "Portuguese (BR)"

Seam needs to detect Obsidian's current language and use it to show the right version of localization. Currently supported languages are:

- English (US)
- Portuguese (BR)

If an unsupported language is set as Obsidian's language, we fallback to English as default.

Append a guide and instructions for the i8n on the README file.

---

Add a translated version of the README file (pt-br), and add a link to it on the main one.

```
> **English** · [Português](https://github.com/wilACosta/seam/blob/main/README.pt-br.md)
```