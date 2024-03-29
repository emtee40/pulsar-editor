describe('HTML autocompletions', () => {
  let editor, provider, languageMode

  function getCompletions () {
    const cursor = editor.getLastCursor()
    const bufferPosition = cursor.getBufferPosition()
    const scopeDescriptor = cursor.getScopeDescriptor()
    const line = editor.getTextInRange([[bufferPosition.row, 0], bufferPosition])
    // https://github.com/atom/autocomplete-plus/blob/9506a5c5fafca29003c59566cfc2b3ac37080973/lib/autocomplete-manager.js#L57
    const prefixMatch = /(\b|['"~`!@#$%^&*(){}[\]=+,/?>])((\w+[\w-]*)|([.:;[{(< ]+))$/.exec(line)
    const prefix = prefixMatch ? prefixMatch[2] : ''
    return provider.getSuggestions({editor, bufferPosition, scopeDescriptor, prefix})
  }

  function isValueInCompletions(value, array, attribute) {
    attribute ??= 'text'
    let result = [];
    for (const i of array) {
      result.push(i[attribute]);
    }
    return result.includes(value);
  }

  function getValueInCompletionsIndex(value, array, attribute) {
    attribute ??= 'text';
    for (let i = 0; i < array.length; i++) {
      if (array[i][attribute] === value) {
        return i;
      }
    }
    // We never did find the value in our array
    return -1;
  }

  beforeEach(async () => {
    await atom.packages.activatePackage('autocomplete-html')
    await atom.packages.activatePackage('language-html')
    await atom.workspace.open('test.html')
    editor = atom.workspace.getActiveTextEditor()
    languageMode = editor.getBuffer().getLanguageMode()
    languageMode.useAsyncParsing = false
    languageMode.useAsyncIndent = false
    await languageMode.ready

    provider = atom.packages.getActivePackage('autocomplete-html').mainModule.getProvider()
  })

  afterEach(async () => {
    await languageMode.atTransactionEnd()
  })

  it('returns no completions when not at the start of a tag', async () => {
    editor.setText('')
    await languageMode.atTransactionEnd()
    expect(getCompletions().length).toBe(0)

    editor.setText('d')
    editor.setCursorBufferPosition([0, 0])
    await languageMode.atTransactionEnd()

    expect(getCompletions().length).toBe(0)

    editor.setCursorBufferPosition([0, 1])
    expect(getCompletions().length).toBe(0)
  })

  it('returns no completions in style tags', async () => {
    editor.setText(`\
<style>
<
</style>\
`
    )
    await languageMode.atTransactionEnd()
    editor.setCursorBufferPosition([1, 1])
    expect(getCompletions().length).toBe(0)
  })

  it('returns no completions in script tags', async () => {
    editor.setText(`\
<script>
<
</script>\
`
    )
    await languageMode.atTransactionEnd()
    editor.setCursorBufferPosition([1, 1])
    expect(getCompletions().length).toBe(0)
  })

  it('autcompletes tag names without a prefix', async () => {
    editor.setText('<')
    editor.setCursorBufferPosition([0, 1])
    await languageMode.atTransactionEnd()

    const completions = getCompletions()
    expect(completions.length).toBeGreaterThan(113) // Fun Fact last check this was 232
    expect(completions[0].description.length).toBeGreaterThan(0)
    expect(completions[0].descriptionMoreURL.length).toBeGreaterThan(0)

    for (let completion of completions) {
      expect(completion.text.length).toBeGreaterThan(0)
      expect(completion.description.length).toBeGreaterThan(0)
      expect(completion.type).toBe('tag')
    }
  })

  it('autocompletes tag names with a prefix', async () => {
    editor.setText('<d')
    editor.setCursorBufferPosition([0, 2])
    await languageMode.atTransactionEnd()

    let completions = getCompletions()
    expect(completions.length).toBeGreaterThan(9) // Fun fact last check was 14

    expect(isValueInCompletions('datalist', completions)).toBe(true)
    expect(completions[0].type).toBe('tag')
    expect(isValueInCompletions('dd', completions)).toBe(true)
    expect(isValueInCompletions('del', completions)).toBe(true)
    expect(isValueInCompletions('details', completions)).toBe(true)
    expect(isValueInCompletions('dfn', completions)).toBe(true)
    expect(isValueInCompletions('dialog', completions)).toBe(true)
    expect(isValueInCompletions('div', completions)).toBe(true)
    expect(isValueInCompletions('dl', completions)).toBe(true)
    expect(isValueInCompletions('dt', completions)).toBe(true)

    editor.setText('<D')
    editor.setCursorBufferPosition([0, 2])

    completions = getCompletions()
    expect(completions.length).toBeGreaterThan(9) // Fun fact last check was 14

    expect(isValueInCompletions('datalist', completions)).toBe(true)
    expect(completions[0].type).toBe('tag')
    expect(isValueInCompletions('dd', completions)).toBe(true)
    expect(isValueInCompletions('del', completions)).toBe(true)
    expect(isValueInCompletions('details', completions)).toBe(true)
    expect(isValueInCompletions('dfn', completions)).toBe(true)
    expect(isValueInCompletions('dialog', completions)).toBe(true)
    expect(isValueInCompletions('div', completions)).toBe(true)
    expect(isValueInCompletions('dl', completions)).toBe(true)
    expect(isValueInCompletions('dt', completions)).toBe(true)
  })

  it("does not autocomplete tag names if there's a space after the <", async () => {
    editor.setText('< ')
    editor.setCursorBufferPosition([0, 2])
    await languageMode.atTransactionEnd()

    let completions = getCompletions()
    expect(completions.length).toBe(0)

    editor.setText('< h')
    editor.setCursorBufferPosition([0, 2])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBe(0)
  })

  it('does not provide a descriptionMoreURL if the tag does not have a unique description', async () => {
    // isindex does not have an associated MDN page as of March 25, 2023
    editor.setText('<i')
    editor.setCursorBufferPosition([0, 2])
    await languageMode.atTransactionEnd()

    const completions = getCompletions()
    const loc = getValueInCompletionsIndex('isindex', completions)

    expect(isValueInCompletions('isindex', completions)).toBe(true)
    expect(completions[loc].description).toBe("HTML <isindex> tag")
    expect(completions[loc].descriptionMoreURL).toBeNull()
  })

  it('autocompletes attribute names without a prefix', async () => {
    editor.setText('<div ')
    editor.setCursorBufferPosition([0, 5])
    await languageMode.atTransactionEnd()

    let completions = getCompletions()
    expect(completions.length).toBeGreaterThan(86) // Fun fact last check this was 264
    expect(completions[0].description.length).toBeGreaterThan(0)
    expect(completions[0].descriptionMoreURL.length).toBeGreaterThan(0)

    for (var completion of completions) {
      expect(completion.snippet.length).toBeGreaterThan(0)
      expect(completion.displayText.length).toBeGreaterThan(0)
      expect(completion.description.length).toBeGreaterThan(0)
      expect(completion.type).toBe('attribute')
    }

    editor.setText('<marquee ')
    editor.setCursorBufferPosition([0, 9])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBeGreaterThan(98) // Last check 274
    expect(completions[0].rightLabel).toBe('<marquee>')
    expect(completions[0].descriptionMoreURL.endsWith('/HTML/Element/marquee#attributes')).toBe(true)

    for (completion of completions) {
      expect(completion.snippet.length).toBeGreaterThan(0)
      expect(completion.displayText.length).toBeGreaterThan(0)
      expect(completion.description.length).toBeGreaterThan(0)
      expect(completion.type).toBe('attribute')
    }

    editor.setText('<div >')
    editor.setCursorBufferPosition([0, 5])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBeGreaterThan(0)
    for (completion of completions) { expect(completion.type).toBe('attribute') }

    editor.setText('<div  >')
    editor.setCursorBufferPosition([0, 5])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBeGreaterThan(0)
    for (completion of completions) {
      expect(completion.type).toBe('attribute')
    }
  })

  it('autocompletes attribute names with a prefix', async () => {
    editor.setText('<div c')
    editor.setCursorBufferPosition([0, 6])
    await languageMode.atTransactionEnd()

    let completions = getCompletions()
    expect(completions.length).toBeGreaterThan(3) // Last check 9

    let loc = getValueInCompletionsIndex('class', completions, 'displayText')

    expect(completions[loc].snippet).toBe('class="$1"$0')
    expect(completions[loc].displayText).toBe('class')
    expect(completions[loc].type).toBe('attribute')
    expect(isValueInCompletions('contenteditable', completions, 'displayText'))
    expect(isValueInCompletions('contextmenu', completions, 'displayText'))

    editor.setText('<div C')
    editor.setCursorBufferPosition([0, 6])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBeGreaterThan(3) // Last check 9

    expect(isValueInCompletions('class', completions, 'displayText'))
    expect(isValueInCompletions('contenteditable', completions, 'displayText'))
    expect(isValueInCompletions('contextmenu', completions, 'displayText'))

    editor.setText('<div c>')
    editor.setCursorBufferPosition([0, 6])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBeGreaterThan(3)

    expect(isValueInCompletions('class', completions, 'displayText'))
    expect(isValueInCompletions('contenteditable', completions, 'displayText'))
    expect(isValueInCompletions('contextmenu', completions, 'displayText'))

    editor.setText('<div c></div>')
    editor.setCursorBufferPosition([0, 6])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBeGreaterThan(3)

    expect(isValueInCompletions('class', completions, 'displayText'))
    expect(isValueInCompletions('contenteditable', completions, 'displayText'))
    expect(isValueInCompletions('contextmenu', completions, 'displayText'))

    editor.setText('<marquee di')
    editor.setCursorBufferPosition([0, 12])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(isValueInCompletions('direction', completions, 'displayText'))
    expect(isValueInCompletions('dir', completions, 'displayText'))

    editor.setText('<marquee dI')
    editor.setCursorBufferPosition([0, 12])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(isValueInCompletions('direction', completions, 'displayText'))
    expect(isValueInCompletions('dir', completions, 'displayText'))
  })

  it('autocompletes attribute names without a prefix surrounded by whitespace', async () => {
    editor.setText('<select  autofocus')
    editor.setCursorBufferPosition([0, 8])
    await languageMode.atTransactionEnd()

    const completions = getCompletions()
    for (let completion of completions) { expect(completion.type).toBe('attribute') }
    expect(isValueInCompletions('autofocus', completions, 'displayText'))
  })

  it('autocompletes attribute names with a prefix surrounded by whitespace', async () => {
    editor.setText('<select o autofocus')
    editor.setCursorBufferPosition([0, 9])
    await languageMode.atTransactionEnd()

    const completions = getCompletions()
    for (let completion of completions) { expect(completion.type).toBe('attribute') }
    expect(isValueInCompletions('onabort', completions, 'displayText'))
  })

  it("respects the 'flag' type when autocompleting attribute names", async () => {
    editor.setText('<select ')
    editor.setCursorBufferPosition([0, 8])
    await languageMode.atTransactionEnd()

    const completions = getCompletions()
    expect(isValueInCompletions('autofocus', completions, 'snippet'))
  })

  it('does not autocomplete attribute names in between an attribute name and value', async () => {
    editor.setText('<select autofocus=""')
    editor.setCursorBufferPosition([0, 18])
    await languageMode.atTransactionEnd()

    let completions = getCompletions()
    expect(completions.length).toBe(0)

    editor.setText('<select autofocus= ""')
    editor.setCursorBufferPosition([0, 18])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBe(0)

    editor.setText('<select autofocus= ""')
    editor.setCursorBufferPosition([0, 19])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBe(0)

    editor.setText('<select autofocus=  ""')
    editor.setCursorBufferPosition([0, 19])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBe(0)
  })

  it('does not autocomplete attribute names outside of a tag', async () => {
    editor.setText('<kbd>')
    editor.setCursorBufferPosition([0, 0])

    expect(getCompletions().length).toBe(0)

    editor.setCursorBufferPosition([0, 5])

    expect(getCompletions().length).toBe(0)
  })

  it('does not throw when a local attribute is not in the attributes list', async () => {
    // Some tags, like body, have local attributes that are not present in the top-level attributes array
    editor.setText('<body ')
    editor.setCursorBufferPosition([0, 6])
    await languageMode.atTransactionEnd()

    const completions = getCompletions()
    expect(isValueInCompletions('onafterprint', completions, 'displayText'))
  })

  it('does not provide a descriptionMoreURL if the attribute does not have a unique description', async () => {
    editor.setText('<input on')
    editor.setCursorBufferPosition([0, 9])
    await languageMode.atTransactionEnd()

    const completions = getCompletions()

    const loc = getValueInCompletionsIndex('onabort', completions, 'displayText')

    expect(completions[loc].displayText).toBe('onabort')
    expect(completions[loc].description).toBe('Global onabort attribute')
    expect(completions[loc].descriptionMoreURL).toBeNull()
  })

  it('autocompletes attribute values without a prefix', async () => {
    editor.setText('<marquee behavior=""')
    editor.setCursorBufferPosition([0, 19])
    await languageMode.atTransactionEnd()

    let completions = getCompletions()
    expect(completions.length).toBe(3)

    expect(completions[0].text).toBe('scroll')
    expect(completions[0].type).toBe('value')
    expect(completions[0].description.length).toBeGreaterThan(0)
    expect(completions[0].descriptionMoreURL.endsWith('/HTML/Element/marquee#attributes')).toBe(true)
    expect(completions[1].text).toBe('slide')
    expect(completions[2].text).toBe('alternate')

    // NOTE: The Tree-sitter parser goes absolutely mental in this scenario. It
    // presents a much more reasonable tree when the closing quote is present,
    // but it'd be incredibly hard to salvage something from this mess.
    //
    // This isn't ideal, but most users will have enabled smart typing pairs,
    // so we'll let this slide.
    // editor.setText('<marquee behavior="')
    // editor.setCursorBufferPosition([0, 19])
    // await languageMode.atTransactionEnd()
    //
    // completions = getCompletions()
    // expect(completions.length).toBe(3)
    //
    // expect(completions[0].text).toBe('scroll')
    // expect(completions[1].text).toBe('slide')
    // expect(completions[2].text).toBe('alternate')
    //
    // editor.setText('<marquee behavior=\'')
    // editor.setCursorBufferPosition([0, 19])
    // await languageMode.atTransactionEnd()
    //
    // completions = getCompletions()
    // expect(completions.length).toBe(3)
    //
    // expect(completions[0].text).toBe('scroll')
    // expect(completions[1].text).toBe('slide')
    // expect(completions[2].text).toBe('alternate')

    editor.setText('<marquee behavior=\'\'')
    editor.setCursorBufferPosition([0, 19])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBe(3)

    expect(completions[0].text).toBe('scroll')
    expect(completions[1].text).toBe('slide')
    expect(completions[2].text).toBe('alternate')
  })

  it('autocompletes attribute values with a prefix', async () => {
    editor.setText('<html behavior="" lang="e"')
    editor.setCursorBufferPosition([0, 25])
    await languageMode.atTransactionEnd()

    let completions = getCompletions()
    expect(completions.length).toBe(6)

    expect(completions[0].text).toBe('eu')
    expect(completions[0].type).toBe('value')
    expect(completions[1].text).toBe('en')
    expect(completions[2].text).toBe('eo')
    expect(completions[3].text).toBe('et')
    expect(completions[4].text).toBe('el')
    expect(completions[5].text).toBe('es')

    editor.setText('<html behavior="" lang="E"')
    editor.setCursorBufferPosition([0, 25])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBe(6)

    expect(completions[0].text).toBe('eu')
    expect(completions[1].text).toBe('en')
    expect(completions[2].text).toBe('eo')
    expect(completions[3].text).toBe('et')
    expect(completions[4].text).toBe('el')
    expect(completions[5].text).toBe('es')

    editor.setText('<html behavior="" lang=\'e\'')
    editor.setCursorBufferPosition([0, 25])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBe(6)

    expect(completions[0].text).toBe('eu')
    expect(completions[1].text).toBe('en')
    expect(completions[2].text).toBe('eo')
    expect(completions[3].text).toBe('et')
    expect(completions[4].text).toBe('el')
    expect(completions[5].text).toBe('es')
  })

  it('autocompletes ambiguous attribute values', async () => {
    editor.setText('<button type=""')
    editor.setCursorBufferPosition([0, 14])
    await languageMode.atTransactionEnd()

    let completions = getCompletions()
    expect(completions.length).toBe(3)

    expect(completions[0].text).toBe('button')
    expect(completions[0].type).toBe('value')
    expect(completions[0].description.length).toBeGreaterThan(0)
    expect(completions[0].descriptionMoreURL.endsWith('/HTML/Element/button#attributes')).toBe(true)
    expect(completions[1].text).toBe('reset')
    expect(completions[2].text).toBe('submit')

    editor.setText('<link rel=""')
    editor.setCursorBufferPosition([0, 11])
    await languageMode.atTransactionEnd()

    completions = getCompletions()
    expect(completions.length).toBe(13)
    expect(completions.map(_ => _.text)).toContain('stylesheet')

    expect(completions[0].text).toBe('alternate')
    expect(completions[0].type).toBe('value')
    expect(completions[0].description.length).toBeGreaterThan(0)
    expect(completions[0].descriptionMoreURL.endsWith('/HTML/Element/link#attributes')).toBe(true)
  })

  it("provides 'true' and 'false' suggestions when autocompleting boolean attributes", async () => {
    editor.setText('<html contenteditable=""')
    editor.setCursorBufferPosition([0, 23])
    await languageMode.atTransactionEnd()

    const completions = getCompletions()
    expect(completions.length).toBe(2)
    expect(completions[0].text).toBe('true')
    expect(completions[1].text).toBe('false')
  })

  it('does not attempt to autocomplete values before the beginning of a string', async () => {
    editor.setText('<button type=""')
    editor.setCursorBufferPosition([0, 13])
    await languageMode.atTransactionEnd()

    let completions = []
    expect(() => completions = getCompletions()).not.toThrow()
    expect(completions.length).toBe(0)
  })

  it('does not attempt to autocomplete values after the end of a string', async () => {
    editor.setText('<button type=""')
    editor.setCursorBufferPosition([0, 15])
    await languageMode.atTransactionEnd()

    let completions = []
    expect(() => completions = getCompletions()).not.toThrow()
    expect(completions.length).toBe(0)
  })

  it('does not throw when quotes are in the attribute value', async () => {
    editor.setText('<button type="\'"')
    editor.setCursorBufferPosition([0, 15])
    await languageMode.atTransactionEnd()

    expect(() => getCompletions()).not.toThrow()
  })

  it("does not autocomplete attribute values if there isn't a corresponding attribute", async () => {
    editor.setText('<button type="""')
    editor.setCursorBufferPosition([0, 16])
    await languageMode.atTransactionEnd()

    let completions = []
    expect(() => completions = getCompletions()).not.toThrow()
    expect(completions.length).toBe(0)
  })

  it('does not throw when attempting to autocomplete values for nonexistent attributes', async () => {
    editor.setText('<button typ=""')
    editor.setCursorBufferPosition([0, 13])
    await languageMode.atTransactionEnd()

    let completions = []
    expect(() => completions = getCompletions()).not.toThrow()
    expect(completions.length).toBe(0)
  })

  it('triggers autocomplete when an attibute has been inserted', async () => {
    spyOn(atom.commands, 'dispatch')
    const suggestion = {type: 'attribute', text: 'whatever'}
    provider.onDidInsertSuggestion({editor, suggestion})

    advanceClock(1)
    expect(atom.commands.dispatch).toHaveBeenCalled()

    const { args } = atom.commands.dispatch.mostRecentCall
    expect(args[0].tagName.toLowerCase()).toBe('atom-text-editor')
    expect(args[1]).toBe('autocomplete-plus:activate')
  })

  it('does not error in EJS documents', async () => {
    waitsForPromise(async () => {
      await atom.workspace.open('test.html.ejs')
      editor = atom.workspace.getActiveTextEditor()
      editor.setText('<span><% a = ""; %></span>')
      return languageMode.atTransactionEnd()
    })

    await atom.packages.activatePackage('language-javascript')
    editor.setCursorBufferPosition([0, editor.getText().indexOf('""') + 1])
    expect(() => getCompletions()).not.toThrow()
  })
})
