## Implement a human-friendly daily note name

1. We should display a human-readable date format when searching for daily notes in Seam Universal Palette; currently, it shows only the number:

```
digital p|
--------------------
2026-10-02
... in a digital painting course.
```

So, in a readable format, it should be:

```
digital p|
--------------------------------
2 Oct. 2026
(icon) Daily Note
... in a digital painting course.
```

2. Append a subtitle "Daily Note" below the result item title and a `calendar-days` icon; Just like we have for folder names, use the same style.