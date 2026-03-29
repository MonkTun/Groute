import { type ExpoConfig, type ConfigContext } from 'expo/config'

// Load .env file for local development (file won't exist on EAS cloud)
try {
  require('dotenv').config({ path: '../../.env' })
} catch {
  // dotenv is a devDependency — may not be available on EAS cloud builds
}

// Helper: read env var with NEXT_PUBLIC_ prefix (local .env) or without (EAS cloud)
function env(name: string): string | undefined {
  return process.env[`NEXT_PUBLIC_${name}`] ?? process.env[name]
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Groute',
  owner: 'tundraswan',
  slug: 'groute',
  version: '0.1.7',
  orientation: 'portrait',
  // icon: './assets/icon.png',
  scheme: 'groute',
  userInterfaceStyle: 'automatic',
  newArchEnabled: false,
  splash: {
    backgroundColor: '#fafafa',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.groute.app',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#000000',
    },
    package: 'com.groute.app',
  },
  web: {
    bundler: 'metro',
    output: 'static' as const,
  },
  plugins: [
    'expo-router',
    ['expo-location', {
      locationAlwaysAndWhenInUsePermission: 'Allow Groute to use your location to find nearby activities and show you on the map.',
    }],
    'expo-image-picker',
    '@react-native-community/datetimepicker',
  ],
  extra: {
    eas: { projectId: '89f29baf-b117-4d7a-b341-76c8991d6baf' },
    supabaseUrl: env('SUPABASE_URL'),
    supabaseAnonKey: env('SUPABASE_ANON_KEY'),
    apiUrl: env('APP_URL'),
    mapboxToken: env('MAPBOX_TOKEN'),
  },
})
