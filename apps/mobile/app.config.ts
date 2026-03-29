import { config as loadEnv } from 'dotenv'
import { type ExpoConfig, type ConfigContext } from 'expo/config'

loadEnv({ path: '../../.env' })

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Groute',
  owner: 'tundraswan',
  slug: 'groute',
  version: '0.1.3',
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
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    apiUrl: process.env.NEXT_PUBLIC_APP_URL,
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  },
})
