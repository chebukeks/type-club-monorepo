import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSuggestionTags,
  parseSuggestionsFromMarkdown,
  applySuggestionDecision,
  getCleanMarkdown,
  proposeSuggestionInMarkdown,
} from '../editor/suggestionUtils'

describe('Suggestion Utilities', () => {
  it('should generate valid suggestion tags for replacement', () => {
    const tags = createSuggestionTags({
      odId: 'test_sug_123',
      authorName: 'AdvisorBot',
      originalText: 'mistake',
      replacementText: 'correction',
      comment: 'Fix typo',
    })

    assert.ok(tags.includes('class="suggestion-delete"'))
    assert.ok(tags.includes('mistake'))
    assert.ok(tags.includes('class="suggestion-insert"'))
    assert.ok(tags.includes('correction'))
    assert.ok(tags.includes('class="suggestion-note"'))
    assert.ok(tags.includes('data-note-id="test_sug_123"'))
    assert.ok(tags.includes('data-note-text="Fix typo"'))
  })

  it('should parse suggestions from markdown string', () => {
    const markdown =
      'Hello world, this is a <span class="suggestion-delete" data-od-id="sug1" data-sug-author-name="AI">bad</span><span class="suggestion-insert" data-od-id="sug1" data-sug-author-name="AI">good</span><span class="suggestion-note" data-od-id="sug1" data-sug-note-text="Better word"></span> sentence.'

    const suggestions = parseSuggestionsFromMarkdown(markdown)
    assert.equal(suggestions.length, 1)
    assert.equal(suggestions[0].odId, 'sug1')
    assert.equal(suggestions[0].type, 'replace')
    assert.equal(suggestions[0].deletedText, 'bad')
    assert.equal(suggestions[0].insertedText, 'good')
    assert.equal(suggestions[0].noteText, 'Better word')
    assert.equal(suggestions[0].authorName, 'AI')
  })

  it('should apply accept decision correctly', () => {
    const markdown =
      'Prefix <span class="suggestion-delete" data-od-id="sug1">old</span><span class="suggestion-insert" data-od-id="sug1">new</span><span class="suggestion-note" data-od-id="sug1"></span> suffix'

    const accepted = applySuggestionDecision(markdown, 'sug1', 'accept')
    assert.equal(accepted, 'Prefix new suffix')
  })

  it('should apply reject decision correctly', () => {
    const markdown =
      'Prefix <span class="suggestion-delete" data-od-id="sug1">old</span><span class="suggestion-insert" data-od-id="sug1">new</span><span class="suggestion-note" data-od-id="sug1"></span> suffix'

    const rejected = applySuggestionDecision(markdown, 'sug1', 'reject')
    assert.equal(rejected, 'Prefix old suffix')
  })

  it('should getCleanMarkdown in accepted mode', () => {
    const markdown =
      'Start <span class="suggestion-delete" data-od-id="sug1">foo</span><span class="suggestion-insert" data-od-id="sug1">bar</span> end.'

    const clean = getCleanMarkdown(markdown, 'accepted')
    assert.equal(clean, 'Start bar end.')
  })

  it('should proposeSuggestionInMarkdown with search and replace', () => {
    const source = 'The quick brown fox jumps over the lazy dog.'
    const result = proposeSuggestionInMarkdown(
      source,
      'lazy dog',
      'energetic puppy',
      'Editor (AI)',
      'Sounds friendlier'
    )

    assert.ok(result.includes('The quick brown fox jumps over the <span class="suggestion-delete"'))
    assert.ok(result.includes('lazy dog</span><span class="suggestion-insert"'))
    assert.ok(result.includes('energetic puppy</span>'))
    assert.ok(result.includes('data-sug-note-text="Sounds friendlier"'))
  })
})
