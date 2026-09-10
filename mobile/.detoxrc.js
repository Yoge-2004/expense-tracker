/** @type {DetoxConfig} */
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  config: {
    testTimeout: 120000,
    reportSpecs: true,
    artifacts: {
      rootDir: 'e2e/artifacts',
      plugins: {
        screenshot: {
          enabled: true,
          shouldTakeAutomaticSnapshots: false,
          keepOnlyFailedTestsArtifacts: true,
        },
        log: 'all',
        instrumentation: 'all',
        timeline: 'all',
      },
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/ExpenseTracker.app',
      build: 'xcodebuild -workspace ios/ExpenseTracker.xcworkspace -scheme ExpenseTracker -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/ExpenseTracker.app',
      build: 'xcodebuild -workspace ios/ExpenseTracker.xcworkspace -scheme ExpenseTracker -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16 Pro',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_7_Pro_API_34',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
  },
};
