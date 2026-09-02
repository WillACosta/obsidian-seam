
## Filter and debounce

The search feature should enable users to filter tags while they are typing on the search field.

So instead of waiting to have all the text we will add a debouce on the input events, then make the search for all tags that has that searched query.

For example:

```
Input: #ele

Shows: |
#electronics
#electronics/components
#electricity
```

## Add "||" operator

Currently we have support for "OR" as the operador in the search feature, we need to change it and use the "or symbol" so it can be understood by anyone without the need of "Intercionalization".

The "||" is the common operator for programming languages, but it might not be for the end user, if necessary you can use another symbol for that, but explains your reasons behind the decision.

