Date: Sep 15, 2026
Version: 1.0.3
Commit: 27475d8
Failed
Releases

Pass
The main.js release asset has a verified GitHub artifact attestation.

Pass
The styles.css release asset has a verified GitHub artifact attestation.

Network requests

Pass
No suspicious network patterns found.

Behavior

Recommendation
Vault Enumeration: Enumerates all files in the vault (vault.getFiles, getMarkdownFiles, etc.). Gives the plugin access to every file path in the vault.

Recommendation
Local Storage: Persists data in localStorage or sessionStorage instead of the Obsidian plugin data APIs

Pass
Vault Read: Reads individual vault files via the Obsidian API (vault.read, vault.cachedRead)

Pass
Vault Write: Creates or modifies vault files via the Obsidian API (vault.modify, vault.create, etc.)

Source code

Error
Uses Obsidian APIs newer than the declared minAppVersion
obsidianmd/no-unsupported-api
src/settings/SettingsTab.ts:205

Warning
This assertion is unnecessary since it does not change the type of the expression.
src/automation/AutomationQueue.ts:54

Warning
This assertion is unnecessary since the receiver accepts the original type of the expression.
src/utils/hotkey.ts:180

Dependencies

Pass
No vulnerable dependencies found.

Code obfuscation

Pass
No obfuscation detected.

Build verification

Pass
Build reproduced the release main.js byte-for-byte
main.js
This confirms users are running exactly the code visible in the repository.