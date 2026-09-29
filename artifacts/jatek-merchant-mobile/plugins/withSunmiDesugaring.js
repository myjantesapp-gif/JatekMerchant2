const { withAppBuildGradle } = require('expo/config-plugins');

function withSunmiDesugaring(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    const compileOptionsPattern = /(compileOptions\s*\{)([^}]*)(\})/;
    const compileOptions = contents.match(compileOptionsPattern);
    if (!compileOptions) {
      throw new Error('Sunmi desugaring: android/app/build.gradle has no compileOptions block.');
    }
    if (!/\bcoreLibraryDesugaringEnabled\s+true\b/.test(compileOptions[2])) {
      contents = contents.replace(
        compileOptionsPattern,
        (_match, open, body, close) => `${open}${body}\n        coreLibraryDesugaringEnabled true\n    ${close}`,
      );
    }

    const dependenciesPattern = /(dependencies\s*\{)([^}]*)(\})/;
    const dependencies = contents.match(dependenciesPattern);
    if (!dependencies) {
      throw new Error('Sunmi desugaring: android/app/build.gradle has no dependencies block.');
    }
    if (!dependencies[2].includes('com.android.tools:desugar_jdk_libs')) {
      contents = contents.replace(
        dependenciesPattern,
        (_match, open, body, close) => `${open}${body}\n    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.4'\n${close}`,
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = withSunmiDesugaring;