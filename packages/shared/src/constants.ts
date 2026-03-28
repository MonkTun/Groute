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
