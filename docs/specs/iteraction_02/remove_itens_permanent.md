Refactor the plugin's options to remove tags and properties after moving a note to the "Permanent" folder.

We should refactor the options to add a new section to better separation of behaviors:

```
Moving Notes Behavior

- Remove tags and properties after moving a note
- Tags to remove (default: #todo, #permanent)
- Properties to remove after moving (default: status)
```

Moving notes here is both "Archiving" and "Permanent Move" process.

So the options will remain the same as current implemented, with the addition to apply them to "permanent" notes as currently they're applied only when archiving.