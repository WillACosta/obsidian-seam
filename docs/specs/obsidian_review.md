Releases

Recommendation
Missing GitHub artifact attestations for release assets
main.js, styles.css
Artifact attestations let users cryptographically verify the provenance of the release assets, proving they were built from the source repository. Learn more

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
For a consistent UI use new Setting(containerEl).setName(...).setHeading() instead of creating HTML heading elements directly.
src/settings/SettingsTab.ts:31
src/settings/SettingsTab.ts:34
src/settings/SettingsTab.ts:89
src/settings/SettingsTab.ts:104
src/settings/SettingsTab.ts:119
src/settings/SettingsTab.ts:163
src/settings/SettingsTab.ts:282

Error
Unexpected undescribed directive comment. Include descriptions to explain why the comment is necessary.
src/settings/SettingsTab.ts:268
src/utils/hotkey.ts:91
src/utils/hotkey.ts:130
src/utils/hotkey.ts:150

Error
Disabling '@typescript-eslint/no-explicit-any' is not allowed.
src/settings/SettingsTab.ts:268
src/utils/hotkey.ts:91
src/utils/hotkey.ts:130
src/utils/hotkey.ts:150

Error
Sets styles directly instead of using CSS classes, setCssProps, or setCssStyles
obsidianmd/no-static-styles-assignment
src/ui/UniversalPalette.ts:113
src/ui/UniversalPalette.ts:157
src/ui/UniversalPalette.ts:162

Error
Avoid using the navigator API to detect the operating system. Use the Platform API instead.
src/utils/hotkey.ts:8

Warning
"builtin-modules" should be replaced with an alternative package.
Learn more
package.json:18

Warning
Use 'window.clearTimeout()' instead of 'clearTimeout()' for popout window compatibility.
src/automation/AutomationQueue.ts:22
src/automation/AutomationQueue.ts:56
src/automation/AutomationQueue.ts:67

Warning
This assertion is unnecessary since the receiver accepts the original type of the expression.
src/automation/AutomationQueue.ts:22
src/automation/AutomationQueue.ts:56
src/search/QueryParser.ts:29
src/search/QueryParser.ts:31
src/search/QueryParser.ts:33
src/search/QueryParser.ts:35

Warning
Use 'window.setTimeout()' instead of 'setTimeout()' for popout window compatibility.
src/automation/AutomationQueue.ts:25

Warning
Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the void operator.
src/automation/AutomationQueue.ts:26
src/main.ts:95
src/main.ts:107
src/main.ts:167
src/main.ts:427
src/ui/UniversalPalette.ts:86
src/ui/UniversalPalette.ts:95
src/ui/UniversalPalette.ts:576
src/ui/UniversalPalette.ts:581

Warning
Unsafe assignment of an error or any typed value
@typescript-eslint/no-unsafe-assignment
src/automation/actions/ArchiveAction.ts:16
src/automation/actions/ArchiveAction.ts:18
src/automation/actions/ArchiveAction.ts:91
src/automation/actions/ArchiveAction.ts:93
src/main.ts:395
src/main.ts:398
src/main.ts:401
src/main.ts:404
src/main.ts:407
src/settings/SettingsTab.ts:269
src/settings/SettingsTab.ts:272
src/utils/hotkey.ts:92
src/utils/hotkey.ts:96
src/utils/hotkey.ts:104
src/utils/hotkey.ts:110
src/utils/hotkey.ts:131
src/utils/hotkey.ts:151

Warning
Unsafe member access on an error or any typed value
@typescript-eslint/no-unsafe-member-access
src/automation/actions/ArchiveAction.ts:84
src/automation/actions/ArchiveAction.ts:88
src/automation/actions/ArchiveAction.ts:90
src/automation/actions/ArchiveAction.ts:91
src/automation/actions/ArchiveAction.ts:92
src/automation/actions/ArchiveAction.ts:93
src/automation/actions/ArchiveAction.ts:93
src/automation/actions/ArchiveAction.ts:93
src/automation/actions/ArchiveAction.ts:109
src/automation/actions/ArchiveAction.ts:111
src/automation/actions/ArchiveAction.ts:114
src/main.ts:401
src/main.ts:404
src/main.ts:407
src/settings/SettingsTab.ts:270
src/settings/SettingsTab.ts:271
src/settings/SettingsTab.ts:272
src/settings/SettingsTab.ts:273
src/settings/SettingsTab.ts:274
src/settings/SettingsTab.ts:275
src/utils/hotkey.ts:92
src/utils/hotkey.ts:95
src/utils/hotkey.ts:96
src/utils/hotkey.ts:103
src/utils/hotkey.ts:104
src/utils/hotkey.ts:108
src/utils/hotkey.ts:110
src/utils/hotkey.ts:131
src/utils/hotkey.ts:134
src/utils/hotkey.ts:135
src/utils/hotkey.ts:137
src/utils/hotkey.ts:138
src/utils/hotkey.ts:151
src/utils/hotkey.ts:154
src/utils/hotkey.ts:155
src/utils/hotkey.ts:156
src/utils/hotkey.ts:157
src/utils/hotkey.ts:160
src/utils/hotkey.ts:161

Warning
Unsafe call of an error or any typed value
@typescript-eslint/no-unsafe-call
src/automation/actions/ArchiveAction.ts:91
src/automation/actions/ArchiveAction.ts:93
src/automation/actions/ArchiveAction.ts:93
src/automation/actions/ArchiveAction.ts:93
src/settings/SettingsTab.ts:271
src/settings/SettingsTab.ts:272
src/settings/SettingsTab.ts:274
src/settings/SettingsTab.ts:275
src/utils/hotkey.ts:96
src/utils/hotkey.ts:104
src/utils/hotkey.ts:110
src/utils/hotkey.ts:135
src/utils/hotkey.ts:138
src/utils/hotkey.ts:155
src/utils/hotkey.ts:157
src/utils/hotkey.ts:161

Warning
Returns unsafe values from typed code
@typescript-eslint/no-unsafe-return
src/automation/actions/ArchiveAction.ts:93

Warning
Don't provide a default hotkey, as they might conflict with other hotkeys the user has already set, or that are included with Obsidian by default.
src/main.ts:66

Warning
This PluginSettingTab does not implement getSettingDefinitions(); its settings will not appear in Obsidian's settings search for users on 1.13.0 or later. Consider adopting the declarative settings API.
src/settings/SettingsTab.ts:17

Warning
Promise returned in function argument where a void return was expected.
src/settings/SettingsTab.ts:212

Warning
Passes unsafe values into typed parameters
@typescript-eslint/no-unsafe-argument
src/settings/SettingsTab.ts:256
src/settings/SettingsTab.ts:258

Warning
Unexpected any. Specify a different type.
src/settings/SettingsTab.ts:256
src/settings/SettingsTab.ts:258

Recommendation
'Notice' is defined but never used.
src/automation/AutomationService.ts:1

Recommendation
display is deprecated. Since 1.13.0. Use {@link getSettingDefinitions} instead.
src/settings/SettingsTab.ts:130
src/settings/SettingsTab.ts:207
src/settings/SettingsTab.ts:240
src/settings/SettingsTab.ts:259

Recommendation
setDynamicTooltip is deprecated. The value is now always shown inline next to the slider.
src/settings/SettingsTab.ts:291

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
