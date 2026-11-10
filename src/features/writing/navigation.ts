import { BookOpen, CalendarCheck, ClipboardCheck, GraduationCap, Layers3, LayoutDashboard, PenLine, Podcast, Sparkles, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type WritaModuleId = 'dashboard' | 'studio' | 'guided' | 'drills' | 'assignments' | 'writing-bank' | 'flashcards' | 'podcasts' | 'coach-assets' | 'assessment' | 'resources' | 'progress' | 'band-descriptors' | 'placement-assessment'

export const writaNavItems: { id: WritaModuleId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'progress', label: 'Learner Profile', icon: Sparkles },
  { id: 'resources', label: 'Learning Library', icon: BookOpen },
  { id: 'writing-bank', label: 'Topics & Vocabulary', icon: BookOpen },
  { id: 'flashcards', label: 'Writia Flashcards', icon: Layers3 },
  { id: 'podcasts', label: 'Writia Podcasts', icon: Podcast },
  { id: 'drills', label: 'Writing Drills', icon: Target },
  { id: 'coach-assets', label: 'Writia Coach Assets', icon: Layers3 },
  { id: 'guided', label: 'Guided Practice', icon: GraduationCap },
  { id: 'studio', label: 'Writing Studio', icon: PenLine },
  { id: 'assignments', label: 'Assignments', icon: CalendarCheck },
  { id: 'assessment', label: 'Performance History', icon: ClipboardCheck },
  { id: 'band-descriptors', label: 'Band Descriptors', icon: GraduationCap },
  { id: 'placement-assessment', label: 'Placement Assessment', icon: Target },
]
