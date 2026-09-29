---
name: Expo native-module autolinking
description: How Expo's Android CNG build discovers React Native native packages.
---

When Expo-generated Android Gradle settings use Expo's React Native autolinking command, a missing standalone `react-native config` executable does not by itself mean native package linking is unavailable. Check the Expo Android React Native autolinking output for the package and its Android entry before adding CLI dependencies or custom Gradle wiring.

**Why:** The monorepo's React Native CLI command was absent, but Expo prebuild generated Gradle settings that resolved the SUNMI native package through Expo's autolinking command.

**How to apply:** For native React Native packages in Expo CNG apps, validate the Android module list via `expo-modules-autolinking react-native-config --json --platform android`; still require an actual Android build and device test for final verification.