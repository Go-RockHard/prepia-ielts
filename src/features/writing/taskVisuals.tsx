import { useEffect, useState } from 'react'

export type TaskVisualKind = 'line' | 'bar' | 'pie' | 'table' | 'process' | 'map' | 'uploaded'
export type TaskVisualSeries = { name: string; values: number[] }
export type TaskVisualMarker = { label: string; x: number; y: number }
export type TaskVisualSpec = {
  kind: TaskVisualKind
  title: string
  caption: string
  dataSummary?: string
  xAxisLabel?: string
  yAxisLabel?: string
  categories?: string[]
  series?: TaskVisualSeries[]
  segments?: { label: string; value: number }[]
  columns?: string[]
  rows?: string[][]
  steps?: string[]
  before?: TaskVisualMarker[]
  after?: TaskVisualMarker[]
  sourceImageId?: string
}

export type VisualTaskRecord = {
  key: string
  username: string
  task: { id: string; label: string; prompt: string; minimumWords: number; type: string }
  visual: TaskVisualSpec
  image?: Blob
}

const DATABASE_NAME = 'writa-task-visuals-v1'
const STORE_NAME = 'tasks'
const DATABASE_VERSION = 1
const chartColors = ['#7167a8', '#4b8a83', '#d29562', '#6484b0']

function openVisualDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support saved visual writing tasks.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open the Writia task database.'))
    request.onblocked = () => reject(new Error('The Writia task database is busy in another tab. Close other Writia tabs and try again.'))
  })
}

export async function saveVisualTaskRecord(record: VisualTaskRecord): Promise<void> {
  const database = await openVisualDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(record)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the complete Writia Task 1.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the Writia Task 1 was interrupted.'))
    })
  } finally {
    database.close()
  }
}

export async function visualImageToBase64(image: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Writia could not prepare the saved task image.'))
        return
      }
      const separator = result.indexOf(',')
      if (separator < 0) {
        reject(new Error('Writia could not prepare the saved task image.'))
        return
      }
      resolve(result.slice(separator + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Writia could not read the saved task image.'))
    reader.readAsDataURL(image)
  })
}

function isVisualTaskRecord(value: unknown, username: string): value is VisualTaskRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record.username !== username || typeof record.key !== 'string'
    || typeof record.task !== 'object' || record.task === null
    || !isTaskVisualSpec(record.visual)) return false
  const task = record.task as Record<string, unknown>
  return typeof task.id === 'string'
    && (task.id.startsWith('custom-task1-') || task.id.startsWith('task1-academic'))
    && record.key === `${username}:${task.id}`
    && typeof task.type === 'string' && task.type === 'IELTS Academic · Task 1'
    && typeof task.label === 'string' && task.label.length > 0 && task.label.length <= 100
    && typeof task.prompt === 'string' && task.prompt.length >= 30 && task.prompt.length <= 1800
    && task.minimumWords === 150
    && (record.visual.kind !== 'uploaded' || record.image instanceof Blob)
}

export async function loadVisualTaskRecords(username: string): Promise<VisualTaskRecord[]> {
  const database = await openVisualDatabase()
  try {
    return await new Promise<VisualTaskRecord[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(request.result.filter((record: unknown): record is VisualTaskRecord => isVisualTaskRecord(record, username)))
      request.onerror = () => reject(request.error ?? new Error('Unable to load saved visual writing tasks.'))
    })
  } finally {
    database.close()
  }
}

export async function loadVisualTaskImage(username: string, taskId: string): Promise<Blob | null> {
  const database = await openVisualDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(`${username}:${taskId}`)
      request.onsuccess = () => {
        const record: unknown = request.result
        resolve(isVisualTaskRecord(record, username) && record.task.id === taskId && record.image instanceof Blob ? record.image : null)
      }
      request.onerror = () => reject(request.error ?? new Error('Unable to load the saved Task 1 image.'))
    })
  } finally {
    database.close()
  }
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function isTextList(value: unknown, minLength: number, maxLength: number, maxTextLength: number): value is string[] {
  return Array.isArray(value) && value.length >= minLength && value.length <= maxLength
    && value.every((item) => isBoundedText(item, maxTextLength))
}

function isVisualSeries(value: unknown, categoryCount: number): value is TaskVisualSeries[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 4
    && value.every((item) => typeof item === 'object' && item !== null
      && isBoundedText((item as Record<string, unknown>).name, 80)
      && Array.isArray((item as Record<string, unknown>).values)
      && ((item as Record<string, unknown>).values as unknown[]).length === categoryCount
      && ((item as Record<string, unknown>).values as unknown[]).every((number) => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1_000_000_000))
}

function isMapMarker(value: unknown): value is TaskVisualMarker {
  if (typeof value !== 'object' || value === null) return false
  const marker = value as Record<string, unknown>
  return isBoundedText(marker.label, 80)
    && typeof marker.x === 'number' && Number.isFinite(marker.x) && marker.x >= 0 && marker.x <= 100
    && typeof marker.y === 'number' && Number.isFinite(marker.y) && marker.y >= 0 && marker.y <= 100
}

export function isTaskVisualSpec(value: unknown): value is TaskVisualSpec {
  if (typeof value !== 'object' || value === null) return false
  const visual = value as Record<string, unknown>
  if (typeof visual.kind !== 'string' || !['line', 'bar', 'pie', 'table', 'process', 'map', 'uploaded'].includes(visual.kind)
    || !isBoundedText(visual.title, 160)
    || typeof visual.caption !== 'string' || visual.caption.length > 500
    || (visual.dataSummary !== undefined && (typeof visual.dataSummary !== 'string' || visual.dataSummary.length > 3000))
    || (visual.xAxisLabel !== undefined && !isBoundedText(visual.xAxisLabel, 100))
    || (visual.yAxisLabel !== undefined && !isBoundedText(visual.yAxisLabel, 100))) return false
  if (visual.kind === 'uploaded') return typeof visual.sourceImageId === 'string' && visual.sourceImageId.length <= 120
  if (visual.kind === 'line' || visual.kind === 'bar') {
    const categories = visual.categories
    return isTextList(categories, 2, 8, 80) && isVisualSeries(visual.series, categories.length)
  }
  if (visual.kind === 'pie') {
    return Array.isArray(visual.segments) && visual.segments.length >= 2 && visual.segments.length <= 8
      && visual.segments.every((item) => typeof item === 'object' && item !== null
        && isBoundedText((item as Record<string, unknown>).label, 80)
        && typeof (item as Record<string, unknown>).value === 'number'
        && Number.isFinite((item as Record<string, unknown>).value)
        && ((item as Record<string, unknown>).value as number) > 0
        && ((item as Record<string, unknown>).value as number) <= 1_000_000_000)
  }
  if (visual.kind === 'table') {
    const columns = visual.columns
    return isTextList(columns, 2, 6, 80)
      && Array.isArray(visual.rows) && visual.rows.length >= 2 && visual.rows.length <= 8
      && visual.rows.every((row) => Array.isArray(row)
        && row.length === columns.length
        && row.every((cell) => isBoundedText(cell, 80)))
  }
  if (visual.kind === 'process') return isTextList(visual.steps, 3, 8, 100)
  return Array.isArray(visual.before) && visual.before.length >= 1 && visual.before.length <= 8
    && Array.isArray(visual.after) && visual.after.length >= 1 && visual.after.length <= 8
    && [...visual.before, ...visual.after].every(isMapMarker)
}

function ChartVisual({ visual }: { visual: TaskVisualSpec }) {
  const categories = visual.categories ?? []
  const series = visual.series ?? []
  const values = series.flatMap((item) => item.values)
  const maxValue = Math.max(1, ...values) * 1.15
  const left = 58
  const top = 28
  const chartWidth = 570
  const chartHeight = 230
  const x = (index: number) => left + (categories.length <= 1 ? 0 : (index / (categories.length - 1)) * chartWidth)
  const y = (value: number) => top + chartHeight - (value / maxValue) * chartHeight
  const barSlot = chartWidth / Math.max(1, categories.length)
  const groupWidth = barSlot * 0.66
  return <svg className="writa-task-visual-svg" viewBox="0 0 680 360" role="img" aria-label={`${visual.kind === 'line' ? 'Line graph' : 'Bar chart'}: ${visual.title}`}>
    <title>{visual.title}</title>
    <text className="writa-svg-title" x="58" y="19">{visual.title}</text>
    {[0, 1, 2, 3].map((step) => {
      const value = (maxValue * step) / 3
      const gridY = y(value)
      return <g key={step}><line className="writa-svg-grid" x1={left} y1={gridY} x2={left + chartWidth} y2={gridY} /><text className="writa-svg-axis" x={left - 9} y={gridY + 4} textAnchor="end">{Number(value.toFixed(1))}</text></g>
    })}
    {visual.kind === 'bar' ? series.map((item, seriesIndex) => item.values.map((value, index) => {
      const width = Math.min(42, groupWidth / series.length - 5)
      const xPosition = left + barSlot * index + (barSlot - (width * series.length + (series.length - 1) * 4)) / 2 + seriesIndex * (width + 4)
      return <rect key={`${item.name}-${index}`} x={xPosition} y={y(value)} width={width} height={Math.max(1, top + chartHeight - y(value))} rx="3" fill={chartColors[seriesIndex % chartColors.length]} />
    })) : series.map((item, seriesIndex) => {
      const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
      return <g key={item.name}><polyline points={points} fill="none" stroke={chartColors[seriesIndex % chartColors.length]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{item.values.map((value, index) => <circle key={index} cx={x(index)} cy={y(value)} r="4" fill={chartColors[seriesIndex % chartColors.length]} />)}</g>
    })}
    {categories.map((label, index) => <text key={label} className="writa-svg-axis" x={visual.kind === 'bar' ? left + barSlot * index + barSlot / 2 : x(index)} y={top + chartHeight + 20} textAnchor="middle">{label}</text>)}
    {visual.yAxisLabel && <text className="writa-svg-axis" transform="rotate(-90 14 150)" x="14" y="150" textAnchor="middle">{visual.yAxisLabel}</text>}
    {series.map((item, index) => <g key={`legend-${item.name}`} transform={`translate(${left + index * 138}, ${top + chartHeight + 42})`}><circle cx="4" cy="0" r="4" fill={chartColors[index % chartColors.length]} /><text className="writa-svg-legend-text" x="13" y="4">{item.name}</text></g>)}
    {visual.xAxisLabel && <text className="writa-svg-axis" x={left + chartWidth / 2} y="344" textAnchor="middle">{visual.xAxisLabel}</text>}
  </svg>
}

function PieVisual({ visual }: { visual: TaskVisualSpec }) {
  const segments = visual.segments ?? []
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const circumference = 2 * Math.PI * 74
  let offset = 0
  return <svg className="writa-task-visual-svg writa-task-pie-svg" viewBox="0 0 680 330" role="img" aria-label={`Pie chart: ${visual.title}`}>
    <title>{visual.title}</title><text className="writa-svg-title" x="34" y="29">{visual.title}</text>
    <g transform="rotate(-90 180 170)">{segments.map((segment, index) => {
      const length = (segment.value / total) * circumference
      const circle = <circle key={segment.label} cx="180" cy="170" r="74" fill="none" stroke={chartColors[index % chartColors.length]} strokeWidth="48" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} />
      offset += length
      return circle
    })}</g>
    <text className="writa-svg-pie-total" x="180" y="166" textAnchor="middle">{segments.length}</text><text className="writa-svg-axis" x="180" y="185" textAnchor="middle">categories</text>
    {segments.map((segment, index) => <g key={`label-${segment.label}`} transform={`translate(355 ${82 + index * 34})`}><circle cx="5" cy="0" r="5" fill={chartColors[index % chartColors.length]} /><text className="writa-svg-legend-text" x="18" y="4">{segment.label} · {((segment.value / total) * 100).toFixed(1)}%</text></g>)}
  </svg>
}

function TableVisual({ visual }: { visual: TaskVisualSpec }) {
  const columns = visual.columns ?? []
  const rows = visual.rows ?? []
  const columnWidth = 600 / columns.length
  return <div className="writa-task-table-visual" role="group" aria-label={`Task 1 table: ${visual.title}`}>
    <strong>{visual.title}</strong><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} style={{ width: `${columnWidth}px` }}>{cell}</td>)}</tr>)}</tbody></table><small>{visual.caption}</small>
  </div>
}

function ProcessVisual({ visual }: { visual: TaskVisualSpec }) {
  const steps = visual.steps ?? []
  const positions = steps.map((_, index) => ({
    x: steps.length <= 4 ? 88 + index * 165 : 78 + (Math.floor(index / 4) % 2 ? 3 - (index % 4) : index % 4) * 165,
    y: steps.length <= 4 ? 100 : 78 + Math.floor(index / 4) * 112,
  }))
  return <svg className="writa-task-visual-svg" viewBox="0 0 720 300" role="img" aria-label={`Process diagram: ${visual.title}`}>
    <title>{visual.title}</title><text className="writa-svg-title" x="30" y="28">{visual.title}</text>
    {steps.map((step, index) => {
      const position = positions[index]
      const next = positions[index + 1]
      const arrowPath = !next ? '' : index === 3 && steps.length > 4
        ? `M ${position.x + 68} ${position.y} L ${position.x + 76} ${position.y} L ${position.x + 76} ${next.y} L ${next.x} ${next.y}`
        : `M ${position.x + 68} ${position.y} L ${next.x - 68} ${next.y}`
      return <g key={`${step}-${index}`}><rect className="writa-svg-process-box" x={position.x - 66} y={position.y - 27} width="132" height="54" rx="8" /><text className="writa-svg-process-text" x={position.x} y={position.y} textAnchor="middle">{step.length > 24 ? `${step.slice(0, 22)}…` : step}</text>{next && <path className="writa-svg-process-arrow" d={arrowPath} markerEnd="url(#writa-arrow)" />}</g>
    })}
    <defs><marker id="writa-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8279b3" /></marker></defs>
  </svg>
}

function MapVisual({ visual }: { visual: TaskVisualSpec }) {
  const maps = [{ title: 'Before', markers: visual.before ?? [] }, { title: 'After', markers: visual.after ?? [] }]
  return <svg className="writa-task-visual-svg writa-task-map-svg" viewBox="0 0 700 340" role="img" aria-label={`Schematic maps: ${visual.title}`}>
    <title>{visual.title}</title><text className="writa-svg-title" x="30" y="26">{visual.title}</text>
    {maps.map((map, mapIndex) => <g key={map.title} transform={`translate(${30 + mapIndex * 330} 48)`}>
      <text className="writa-svg-map-heading" x="130" y="0" textAnchor="middle">{map.title}</text><rect className="writa-svg-map" x="0" y="13" width="280" height="230" rx="8" />
      <path className="writa-svg-map-road" d="M 8 122 L 272 122 M 140 18 L 140 238" />
      {map.markers.map((marker, index) => <g key={`${marker.label}-${index}`} transform={`translate(${18 + marker.x * 2.44} ${30 + marker.y * 1.82})`}><circle className="writa-svg-map-marker" r="5" /><text className="writa-svg-map-label" x="8" y="3">{marker.label.length > 18 ? `${marker.label.slice(0, 16)}…` : marker.label}</text></g>)}
    </g>)}
  </svg>
}

export function WritaTaskVisual({ username, taskId, visual }: { username: string; taskId: string; visual: TaskVisualSpec }) {
  const [imageUrl, setImageUrl] = useState('')
  const [imageError, setImageError] = useState('')

  useEffect(() => {
    if (visual.kind !== 'uploaded') {
      setImageUrl('')
      setImageError('')
      return
    }
    let active = true
    let objectUrl = ''
    setImageUrl('')
    setImageError('')
    void loadVisualTaskImage(username, visual.sourceImageId ?? taskId).then((image) => {
      if (!active) return
      if (!image) {
        setImageError('The saved source image is unavailable in this browser.')
        return
      }
      objectUrl = URL.createObjectURL(image)
      setImageUrl(objectUrl)
    }).catch((error: unknown) => {
      console.error('Unable to load the saved Writia Task 1 image.', error)
      if (active) setImageError(error instanceof Error ? error.message : 'Unable to load the saved Task 1 image.')
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [taskId, username, visual.kind, visual.sourceImageId])

  return <figure className="writa-task-visual" data-task-visual-task-id={taskId}>
    {visual.kind === 'uploaded'
      ? imageUrl ? <img src={imageUrl} alt={visual.title} /> : imageError ? <p className="writa-task-visual-error" role="alert">{imageError}</p> : <p className="writa-task-visual-loading">Loading saved task visual…</p>
      : visual.kind === 'line' || visual.kind === 'bar' ? <ChartVisual visual={visual} />
        : visual.kind === 'pie' ? <PieVisual visual={visual} />
          : visual.kind === 'table' ? <TableVisual visual={visual} />
            : visual.kind === 'process' ? <ProcessVisual visual={visual} />
              : visual.kind === 'map' ? <MapVisual visual={visual} />
                : null}
    <figcaption>{visual.kind === 'map' && !/not to scale/i.test(visual.caption)
      ? `${visual.caption}${visual.caption ? ' ' : ''}Schematic illustration; not to scale.`
      : visual.caption}</figcaption>
  </figure>
}
