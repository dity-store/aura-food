import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aurafood.pos',
  appName: 'Aura Food - Kasir',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#ffffffff",
      androidScaleType: "FIT_CENTER"
    }
  }
};

export default config;
