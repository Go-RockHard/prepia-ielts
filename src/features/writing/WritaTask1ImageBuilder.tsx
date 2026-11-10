import { useEffect, useState } from 'react'
import { FileImage, LoaderCircle, Sparkles, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleGenAI } from '@/lib/geminiClient'
import { reportGeminiQuota } from '@/lib/geminiQuota'
import { saveVisualTaskRecord, visualImageToBase64, type TaskVisualSpec, type VisualTaskRecord } from './taskVisuals'

type GeneratedTask = { id: string; type: string; label: string; prompt: string; minimumWords: number }
type TaskImageDescription = { title: string; prompt: string; caption: string; dataSummary: string }

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Writia could not create a task from this image.'
  return message
    .replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted]')
}

function parseImageTask(text: string): TaskImageDescription {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    console.error('Writia returned invalid Task 1 image-analysis JSON.', error)
    throw new Error('Writia could not read the generated task. Please try again.')
  }
  if (typeof value !== 'object' || value === null) throw new Error('Writia could not identify a complete Task 1 prompt in that image.')
  const record = value as Record<string, unknown>
  if (record.error === 'unreadable') throw new Error('The image is too unclear to read accurately. Try a sharper crop with the chart labels and data visible.')
  if (typeof record.title !== 'string' || !record.title.trim() || record.title.length > 100
    || typeof record.prompt !== 'string' || record.prompt.trim().length < 60 || record.prompt.length > 1400
    || typeof record.caption !== 'string' || record.caption.length > 300
    || typeof record.dataSummary !== 'string' || !record.dataSummary.trim() || record.dataSummary.length > 3000) {
    throw new Error('Writia could not create a complete IELTS Task 1 question from this image. Try a clearer chart or diagram.')
  }
  return { title: record.title.trim(), prompt: record.prompt.trim(), caption: record.caption.trim(), dataSummary: record.dataSummary.trim() }
}

export function WritaTask1ImageBuilder({
  apiKey,
  model,
  username,
  onTaskCreated,
}: {
  apiKey: string
  model: string
  username: string
  onTaskCreated: (task: GeneratedTask, visual: TaskVisualSpec) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    event.target.value = ''
    setError('')
    if (!selected) {
      setFile(null)
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type)) {
      setFile(null)
      setError('Choose a PNG, JPEG, or WebP image.')
      return
    }
    if (selected.size > 8 * 1024 * 1024) {
      setFile(null)
      setError('Choose an image smaller than 8 MB so it can be analyzed and saved in this browser.')
      return
    }
    setFile(selected)
  }

  async function createTask() {
    if (!file) {
      setError('Choose a chart, graph, table, map, or process image first.')
      return
    }
    if (!apiKey.trim()) {
      setError('Add your shared AI service key in Settings before creating a task from an image.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const imageData = await visualImageToBase64(file)
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [
          { text: `Inspect this IELTS Academic Writing Task 1 visual carefully. Read the actual chart, table, map, or process diagram; do not invent, alter, or infer data that is not visible. Create a complete candidate-facing IELTS-style task prompt that names the visual and its subject, preserves its time period, units, groups, labels, and scope, and ends with the appropriate instruction: normally “Summarise the information by selecting and reporting the main features, and make comparisons where relevant”; for a process or map, use the appropriate version without requiring comparisons where they do not apply. Do not write a model answer or give away the key features. If the image is too blurry or the data/labels are unreadable, return {"error":"unreadable"} instead of guessing. Also provide a precise internal data summary with the visible labels, units, dates, values, and sequence needed for a teacher to check a learner's response; do not include hidden assumptions. Return only JSON: {"title":"short task-bank title","prompt":"complete task statement","caption":"brief accessible description of what the image shows","dataSummary":"faithful transcription/description of the visible information"}.` },
          { inlineData: { mimeType: file.type, data: imageData } },
        ] }],
        config: { temperature: 0.15, responseMimeType: 'application/json' },
      })
      const text = response.text?.trim()
      if (!text) throw new Error('Writia did not return a Task 1 prompt. Please try again.')
      const description = parseImageTask(text)
      const id = `custom-task1-${crypto.randomUUID()}`
      const task: GeneratedTask = {
        id,
        type: 'IELTS Academic · Task 1',
        label: description.title,
        prompt: description.prompt,
        minimumWords: 150,
      }
      const visual: TaskVisualSpec = {
        kind: 'uploaded',
        title: description.title,
        caption: description.caption || 'Source visual supplied by the learner.',
        dataSummary: description.dataSummary,
        sourceImageId: id,
      }
      const record: VisualTaskRecord = {
        key: `${username}:${id}`,
        username,
        task,
        visual,
        image: file,
      }
      await saveVisualTaskRecord(record)
      onTaskCreated(task, visual)
      setFile(null)
    } catch (caughtError) {
      console.error('Unable to create an IELTS Task 1 from an uploaded visual.', caughtError)
      reportGeminiQuota(caughtError)
      setError(safeMessage(caughtError))
    } finally {
      setBusy(false)
    }
  }

  return <section className="writa-task-image-builder" aria-labelledby="writa-task-image-builder-heading">
    <div className="writa-task-image-builder-copy"><span className="writa-task-image-builder-icon"><FileImage size={18} /></span><div><p className="writa-kicker">CREATE A VISUAL TASK</p><h3 id="writa-task-image-builder-heading">Turn a chart into a complete Task 1.</h3><p>Upload a chart, table, map, or process diagram. Writia reads its visible details, creates the candidate prompt, and saves the task with its original image in this browser.</p></div></div>
    <div className="writa-task-image-builder-controls">
      <label className="writa-task-image-picker"><Upload size={15} /><span>{file ? file.name : 'Choose an image'}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} aria-label="Choose a Task 1 visual image" /></label>
      <Button className="writa-primary-button" onClick={() => void createTask()} disabled={busy || !file}>{busy ? <><LoaderCircle className="writa-spin" size={15} /> Reading visual…</> : <><Sparkles size={15} /> Create and save task</>}</Button>
    </div>
    {previewUrl && <div className="writa-task-image-preview"><img src={previewUrl} alt="Selected IELTS Task 1 chart preview" /><button type="button" onClick={() => setFile(null)} aria-label="Remove selected image"><X size={15} /></button></div>}
    {error && <p className="writa-alert" role="alert">{error}</p>}
    <small>PNG, JPEG or WebP · maximum 8 MB. The selected image is sent to your configured Gemini model for analysis; the saved task and source image remain in this browser.</small>
  </section>
}
