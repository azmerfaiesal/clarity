/// <reference types="@capacitor/local-notifications" />

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.azmerfaiesal.clarity',
  appName: 'Clarity',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    zoomEnabled: false,
  },
  plugins: {
    Keyboard: {
      resize: 'native',
    },
    LocalNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
    },
  },
}

export default config
