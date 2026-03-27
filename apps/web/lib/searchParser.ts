/**
 * Parse natural language search queries into structured filters.
 * Examples:
 *   "easy hike Saturday morning" → { sport: "hiking", skill: "beginner", day: "saturday" }
 *   "surfing this weekend" → { sport: "surfing", timeframe: "weekend" }
 *   "advanced climbing" → { sport: "climbing", skill: "advanced" }
 */

interface ParsedSearch {
  sport: string | null
  skill: string | null
  timeframeDays: number | null
}

const SPORT_KEYWORDS: Record<string, string> = {
  hike: 'hiking',
  hiking: 'hiking',
  climb: 'climbing',
  climbing: 'climbing',
  boulder: 'climbing',
  bouldering: 'climbing',
  run: 'trail_running',
  running: 'trail_running',
  trail: 'trail_running',
  surf: 'surfing',
  surfing: 'surfing',
  cycle: 'cycling',
  cycling: 'cycling',
  bike: 'cycling',
  biking: 'cycling',
  'mountain bike': 'mountain_biking',
  'mountain biking': 'mountain_biking',
  mtb: 'mountain_biking',
  ski: 'skiing',
  skiing: 'skiing',
  snowboard: 'skiing',
  kayak: 'kayaking',
  kayaking: 'kayaking',
  paddle: 'kayaking',
  yoga: 'yoga',
}

const SKILL_KEYWORDS: Record<string, string> = {
  easy: 'beginner',
  beginner: 'beginner',
  chill: 'beginner',
  casual: 'beginner',
  moderate: 'intermediate',
  intermediate: 'intermediate',
  medium: 'intermediate',
  hard: 'advanced',
  advanced: 'advanced',
  challenging: 'advanced',
  difficult: 'advanced',
  tough: 'advanced',
}

const TIMEFRAME_KEYWORDS: Record<string, number> = {
  today: 0,
  tonight: 0,
  tomorrow: 1,
  weekend: 3,
  'this weekend': 3,
  'this week': 7,
  week: 7,
  'next week': 14,
  month: 30,
  'this month': 30,
}

export function parseSearchQuery(query: string): ParsedSearch {
  const lower = query.toLowerCase().trim()

  let sport: string | null = null
  let skill: string | null = null
  let timeframeDays: number | null = null

  // Match multi-word patterns first
  for (const [keyword, value] of Object.entries(TIMEFRAME_KEYWORDS)) {
    if (lower.includes(keyword)) {
      timeframeDays = value
      break
    }
  }

  for (const [keyword, value] of Object.entries(SPORT_KEYWORDS)) {
    if (lower.includes(keyword)) {
      sport = value
      break
    }
  }

  for (const [keyword, value] of Object.entries(SKILL_KEYWORDS)) {
    if (lower.includes(keyword)) {
      skill = value
      break
    }
  }

  // Day of week matching
  if (timeframeDays === null) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    for (const day of days) {
      if (lower.includes(day)) {
        const today = new Date().getDay()
        const target = days.indexOf(day)
        let diff = target - today
        if (diff <= 0) diff += 7
        timeframeDays = diff
        break
      }
    }
  }

  return { sport, skill, timeframeDays }
}
