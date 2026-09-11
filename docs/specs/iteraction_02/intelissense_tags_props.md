We should add an "Intellisense" for specific tags after they are removed.

Obsidian stores the intellisense for suggesting tags and properties based on the cached data for available notes in the Vault. If we remove all mentions to a specific tag or property, Obsidian doesn't suggested it when typing its name, for example:

```
** User starts typing a tag name**
User: "perm"
Obsidian Suggests: "permanent"
```

If there's no note with this tag in the Vault, Obsidian doesn't suggest its name.

So we need to investigate how to update the application's cache when a tag or property is removed and then store it in the cache metadata.