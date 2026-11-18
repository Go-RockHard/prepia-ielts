import assert from 'node:assert/strict'
import test from 'node:test'
import { completeGeneratedQuestionShape, extractJsonObject, parseJsonObject } from '../src/features/skills/literacyJson.ts'

test('extracts a JSON object wrapped in a JSON markdown fence', () => {
  assert.equal(extractJsonObject('```json\n{"title":"A {careful} test","ok":true}\n```'), '{"title":"A {careful} test","ok":true}')
})

test('extracts the first complete JSON object from surrounding model text', () => {
  assert.equal(extractJsonObject('Result follows: {"items":[{"value":1}]} Thanks.'), '{"items":[{"value":1}]}')
})

test('reports truncated model output so the generation workflow can repair it', () => {
  assert.throws(() => extractJsonObject('{"title":"unfinished"'), /before the JSON object was complete/)
})

test('repairs trailing commas outside strings in otherwise valid JSON', () => {
  assert.deepEqual(parseJsonObject('```json\n{"message":"keep this comma,","items":[1,2,],}\n```'), {
    message: 'keep this comma,',
    items: [1, 2],
  })
})

test('repairs missing completion labels and IDs using stable visible defaults', () => {
  const question = completeGeneratedQuestionShape({
    type: 'completion',
    gaps: [
      { acceptedAnswers: ['library'] },
      { id: 'provided-gap', label: '  ', acceptedAnswers: ['study room'] },
    ],
  })

  assert.deepEqual(question.gaps, [
    { acceptedAnswers: ['library'], id: 'gap-1', label: 'Answer 1' },
    { id: 'provided-gap', label: 'Answer 2', acceptedAnswers: ['study room'] },
  ])
})

test('repairs missing IDs and display labels in matching and labeling items', () => {
  assert.deepEqual(completeGeneratedQuestionShape({
    type: 'labeling',
    items: [{ answer: 'North entrance' }],
  }), {
    type: 'labeling',
    items: [{ answer: 'North entrance', id: 'item-1', label: 'Label 1' }],
  })
})
