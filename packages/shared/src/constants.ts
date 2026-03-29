export const SPORT_LABELS: Record<string, string> = {
  hiking: "Hiking",
  trail_running: "Trail Running",
};

export const COUNTRIES = [
  "United States",
  "Canada",
  "Mexico",
  "United Kingdom",
  "Australia",
  "New Zealand",
  "South Korea",
  "Japan",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Brazil",
  "Argentina",
  "Colombia",
  "Netherlands",
  "Switzerland",
  "Sweden",
  "Norway",
  "Portugal",
] as const;

export const REGIONS: Record<string, readonly string[]> = {
  "United States": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ],
  "Canada": [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick",
    "Newfoundland and Labrador", "Nova Scotia", "Ontario",
    "Prince Edward Island", "Quebec", "Saskatchewan",
    "Northwest Territories", "Nunavut", "Yukon",
  ],
  "Mexico": [
    "Aguascalientes", "Baja California", "Baja California Sur",
    "Chihuahua", "Ciudad de Mexico", "Jalisco", "Nuevo Leon",
    "Oaxaca", "Puebla", "Quintana Roo", "Yucatan",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  "Australia": [
    "New South Wales", "Victoria", "Queensland", "Western Australia",
    "South Australia", "Tasmania", "Northern Territory",
    "Australian Capital Territory",
  ],
  "South Korea": [
    "Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju",
    "Ulsan", "Sejong", "Gyeonggi", "Gangwon", "Chungcheong",
    "Jeolla", "Gyeongsang", "Jeju",
  ],
  "Japan": [
    "Tokyo", "Osaka", "Kyoto", "Hokkaido", "Okinawa", "Fukuoka",
    "Aichi", "Kanagawa", "Hyogo", "Chiba",
  ],
} as const;

export const PREFERRED_LANGUAGES = [
  "English",
  "Spanish",
  "Korean",
  "Mandarin",
  "Japanese",
  "Tagalog",
  "Armenian",
  "Persian",
  "Vietnamese",
  "Hindi",
] as const;

export const SKILL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  discoverable: "Discoverable",
  private: "Private",
};

export const VISIBILITY_DESCRIPTIONS: Record<string, string> = {
  public: "Anyone can discover and join",
  discoverable: "Anyone can discover, but joining needs approval",
  private: "Invite only",
};

export const DEFAULT_SEARCH_RADIUS_METERS = 32_187; // ~20 miles
export const STRAVA_SYNC_MONTHS = 6;

export const SAC_SCALE_LABELS: Record<string, string> = {
  hiking: "T1 — Easy hiking",
  mountain_hiking: "T2 — Mountain hiking",
  demanding_mountain_hiking: "T3 — Demanding",
  alpine_hiking: "T4 — Alpine",
  demanding_alpine_hiking: "T5 — Demanding alpine",
  difficult_alpine_hiking: "T6 — Difficult alpine",
};

export const SURFACE_LABELS: Record<string, string> = {
  ground: "Ground",
  dirt: "Dirt",
  grass: "Grass",
  gravel: "Gravel",
  sand: "Sand",
  rock: "Rock",
  paved: "Paved",
  asphalt: "Asphalt",
  concrete: "Concrete",
  wood: "Wood",
  unknown: "Unknown",
};

export const DEFAULT_TRAIL_SEARCH_RADIUS_METERS = 8_000; // ~5 miles

// ── Onboarding: Experience & Preferences ──

export const TERRAIN_COMFORT_OPTIONS = [
  "trail",
  "off_trail",
  "scramble",
  "technical",
  "snow_ice",
] as const;

export const TERRAIN_COMFORT_LABELS: Record<string, string> = {
  trail: "Trail",
  off_trail: "Off-trail",
  scramble: "Scramble",
  technical: "Technical",
  snow_ice: "Snow / Ice",
};

export const WATER_COMFORT_OPTIONS = [
  "flatwater",
  "class_i_ii",
  "class_iii_iv",
  "class_v",
  "open_ocean",
] as const;

export const WATER_COMFORT_LABELS: Record<string, string> = {
  flatwater: "Flatwater",
  class_i_ii: "Class I-II rapids",
  class_iii_iv: "Class III-IV rapids",
  class_v: "Class V rapids",
  open_ocean: "Open ocean",
};

export const CERTIFICATION_OPTIONS = [
  "wilderness_first_aid",
  "wilderness_first_responder",
  "belay_certified",
  "lead_climbing",
  "avalanche_level_1",
  "avalanche_level_2",
  "dive_certified",
  "swift_water_rescue",
  "lifeguard",
  "cpr_aed",
] as const;

export const CERTIFICATION_LABELS: Record<string, string> = {
  wilderness_first_aid: "Wilderness First Aid",
  wilderness_first_responder: "Wilderness First Responder",
  belay_certified: "Belay Certified",
  lead_climbing: "Lead Climbing Certified",
  avalanche_level_1: "Avalanche Level 1",
  avalanche_level_2: "Avalanche Level 2",
  dive_certified: "Dive Certified (PADI/SSI)",
  swift_water_rescue: "Swift Water Rescue",
  lifeguard: "Lifeguard",
  cpr_aed: "CPR / AED",
};

export const HAS_CAR_OPTIONS = ["yes", "no", "sometimes"] as const;

export const HAS_CAR_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  sometimes: "Sometimes",
};

export const WILLING_TO_CARPOOL_OPTIONS = ["yes", "no", "within_radius"] as const;

export const WILLING_TO_CARPOOL_LABELS: Record<string, string> = {
  yes: "Yes, happy to!",
  no: "No",
  within_radius: "Within a certain distance",
};

export const MAX_DRIVE_DISTANCE_OPTIONS = [10, 25, 50, 100] as const;

export const PREFERRED_GROUP_SIZE_OPTIONS = ["duo", "small", "medium", "large"] as const;

export const PREFERRED_GROUP_SIZE_LABELS: Record<string, string> = {
  duo: "1-on-1",
  small: "Small (2-4)",
  medium: "Medium (5-8)",
  large: "Large (8+)",
};

export const PREFERRED_TIME_OF_DAY_OPTIONS = [
  "early_morning",
  "morning",
  "afternoon",
  "evening",
] as const;

export const PREFERRED_TIME_OF_DAY_LABELS: Record<string, string> = {
  early_morning: "Early morning (before 7am)",
  morning: "Morning (7am-12pm)",
  afternoon: "Afternoon (12-5pm)",
  evening: "Evening (after 5pm)",
};

export const GEAR_LEVEL_OPTIONS = ["none", "basic", "full"] as const;

export const GEAR_LEVEL_LABELS: Record<string, string> = {
  none: "No gear yet",
  basic: "Basic (day pack, shoes)",
  full: "Full kit (tent, stove, etc.)",
};

export const OVERNIGHT_COMFORT_OPTIONS = ["day_only", "car_camping", "backcountry"] as const;

export const OVERNIGHT_COMFORT_LABELS: Record<string, string> = {
  day_only: "Day trips only",
  car_camping: "Car camping",
  backcountry: "Backcountry camping",
};

export const FITNESS_LEVEL_OPTIONS = ["casual", "active", "athletic", "competitive"] as const;

export const FITNESS_LEVEL_LABELS: Record<string, string> = {
  casual: "Casual",
  active: "Active",
  athletic: "Athletic",
  competitive: "Competitive",
};

export const COMFORT_WITH_STRANGERS_OPTIONS = ["friends_only", "friends_of_friends", "open"] as const;

export const COMFORT_WITH_STRANGERS_LABELS: Record<string, string> = {
  friends_only: "Prefer friends only",
  friends_of_friends: "Friends of friends",
  open: "Open to anyone",
};
