## When searching for tags we need to show the tags in the search results.

Whenever the search input box has a single "#" symbol without texts, we need to show the remaining available tags. The idea is to simplify tag search by displaying them on the go.

For example:

```
User type: #
** Display all tags **
User starts typing: #arch
** Filter tags that contains the query **
Lists: |
	#archived
	#architecture
	#architecture/concept
	#architecture/tools
```

When user chooses one item in the list or complete typing we swap the searching results for all notes with that tag.

Again, if user wants to refine the search and type the "#" symbol, we do the same as before, showing all the tags excluding the ones that already is being searched for.

```
Current query state: #architecture #
** Display all tags but the #architecture **
User starts typing (after the new symbol): #ai
** Filter tags that contains the query (without the one that already is present in the query)**
Lists: |
	#architecture/concept
	#architecture/tools
	#ai
	#ai/sdd
	#ai/concept
```

> Note that we still display nested tags, in the above example the "#architecture/concepts" and "architecture/tools", because the user didn't select them earlier, but its major tag (#architecture), so it may be able to refine the search for something like: "#architecture #architecture/concept  #ai/sdd "
