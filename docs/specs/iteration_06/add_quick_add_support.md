# Include support for "Quick Adds".

This feature is an inspiration of [QuickAdd](https://github.com/chhoumann/quickadd) Plugin, the idea is to enable users to create new notes from the UP (Universal Palette) using specific templates for their pre-defined options.

> If necessary, you may use QuickAdd as inspiration, but do not copy it's implementation, ours is to be much simpler. We just want to implement the quick add notes behavior.

1. We'll include a new command: `> Create a new note` in the UP.

- If there's no options set, we create a note directly inside `Fleeting/` and do not prompt for different options;
- If there is user's options, we display a list of them;

2. Each choice is tied to a specific template, if an option doesn't have a template set, it's created as default - We show a `Notice` telling the user that "This option doesn't have a pre-defined template".

3. Add a new section to the Seam's settings tab to allow users to include their pre-defined choices when creating new notes using this command.

** Quick add note options **:

Choices:
- Add a choice (See UI details on the next section)

When creating a new choice, we open a modal with some additional settings:

```
New choice
Template path: ___________ (string path with intellisense)
Location: ______________ (select - Obsidian's default or Specific folder)
Open: (boolean) "Open the created file" - "If open is true, then we enable the option below:
  Open-behavior: "select - New tab, Current tab, Split pane (right)", default is New tab
  Focus: (boolean) - "Focus the created file after opening"
Icon (optional): "Lucide Icon name"
```

Input;
- Persist input prompt drafts (boolean) -> Keep drafts when closing input prompt, kept only during session.


## UI/UX Definition

1. For the options listing on the UP:

When `> Create a new note` command is chosen, we replace the behavior of the palette input by:

```
Select a choice (If there is pre-defined choices)
-------------------------------------------------
$icon Add Fleeting
$icon Add Book
$icon Add Project
```

- `$icon` is defined by the user in the choice definition.
- `$icon` is hide when icons are disabled in Seam's settings.

2. The choices settings section should list all choices with their icons (if set), and display a button to add a new choice ("+ New choice").

2. When `esc` is pressed we cancel the choice selection and return back to the default UP behavior (search).
