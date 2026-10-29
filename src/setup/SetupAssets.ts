/** Content is created once. Existing templates and Bases always belong to the user. */
export const SETUP_FOLDERS = [
  'Fleeting',
  'Permanent',
  'Resources',
  'Resources/Archive',
  'Resources/Attachments',
  'Resources/Daily',
  'Resources/Sources',
  'Resources/Templates',
  'Resources/Bases',
  'Resources/Seam',
  'Resources/Seam/Statistics',
]

export const BOOKSHELF_PATH = 'Resources/Bases/Bookshelf.base'
export const SETUP_FILES: Record<string, string> = {
  'Resources/Templates/Fleeting Note Template.md':
    '---\ncreated: "{{date:YYYY-MM-DD}}"\n---\n\n# {{title}}\n\n',
  'Resources/Templates/Daily Note Template.md':
    '# {{date:YYYY-MM-DD}}\n\n## Notes\n\n\n## Tasks\n\n- [ ] \n',
  'Resources/Templates/Book Template.md':
    '---\ntags: [books]\nauthors: []\nstatus: unread\npriority: medium\ncover: ""\nstart_date:\nend_date:\ncurrent_page: 0\ntotal_pages: 0\nrating:\nsummary: ""\n---\n\n# {{title}}\n\n',
  [BOOKSHELF_PATH]: `filters:
  and:
    - file.ext == "md"
    - file.hasTag("books")
    - '!file.inFolder("Resources/Templates")'
formulas:
  reading_time: 'if(note.total_pages.isType("number") && note.total_pages > 0, (note.total_pages / 40).round().toString() + " h", "")'
  rating: 'if(note.rating.isType("number"), "★ " + note.rating.toString() + "/10", "")'
  priority_ui: 'if(note.priority == "highest", icon("chevrons-up"), if(note.priority == "high", icon("chevron-up"), if(note.priority == "medium", icon("minus"), if(note.priority == "low", icon("chevron-down"), if(note.priority == "lowest", icon("chevrons-down"), "")))))'
  priority_value: 'if(note.priority == "highest", 5, if(note.priority == "high", 4, if(note.priority == "medium", 3, if(note.priority == "low", 2, if(note.priority == "lowest", 1, 0)))))'
  progress_value: 'if(note.total_pages.isType("number") && note.total_pages > 0 && note.current_page.isType("number"), max(0, min(100, 100 * note.current_page / note.total_pages)), 0)'
  progress: '"●".repeat((formula.progress_value / 20).floor()) + "○".repeat(5 - (formula.progress_value / 20).floor()) + " " + formula.progress_value.round().toString() + "%"'
properties:
  formula.reading_time:
    displayName: Reading time
  formula.rating:
    displayName: Rating
  formula.priority_ui:
    displayName: Priority
  formula.progress:
    displayName: Progress
views:
  - type: cards
    name: Bookshelf
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
    order:
      - file.name
      - formula.rating
      - formula.reading_time
      - note.authors
      - formula.priority_ui
    sort:
      - property: formula.priority_value
        direction: DESC
  - type: cards
    name: Reading
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
    filters:
      and:
        - file.hasTag("reading")
        - note.current_page > 0
        - note.current_page < note.total_pages
    order:
      - file.name
      - note.authors
      - formula.priority_ui
      - formula.progress
      - formula.reading_time
    sort:
      - property: formula.priority_value
        direction: DESC
      - property: formula.progress_value
        direction: DESC
  - type: cards
    name: Stopped
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
    filters:
      and:
        - file.hasTag("stopped")
        - note.current_page > 0
        - note.current_page < note.total_pages
    order:
      - file.name
      - note.authors
      - formula.priority_ui
      - formula.progress
      - formula.reading_time
    sort:
      - property: formula.priority_value
        direction: DESC
      - property: formula.progress_value
        direction: DESC
  - type: cards
    name: Unread
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    cardSize: 150
    filters:
      and:
        - 'note.status.isEmpty() || note.status == "unread"'
        - 'note.current_page.isEmpty() || note.current_page == 0'
    order:
      - file.name
      - note.authors
      - formula.priority_ui
      - formula.reading_time
    sort:
      - property: formula.priority_value
        direction: DESC
`,
}

export const SETUP_PROPERTY_TYPES: Record<string, string> = {
  start_date: 'date',
  end_date: 'date',
  current_page: 'number',
  total_pages: 'number',
  authors: 'multitext',
  rating: 'number',
  priority: 'text',
  cover: 'text',
  summary: 'text',
  status: 'text',
}
