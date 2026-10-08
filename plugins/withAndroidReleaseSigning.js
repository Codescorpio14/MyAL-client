const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    const signingConfigsEnd = '    signingConfigs {\n';
    const debugConfigEnd = '        }\n    }\n    buildTypes {';

    if (!contents.includes(signingConfigsEnd) || !contents.includes(debugConfigEnd)) {
      throw new Error('Could not find the Android signing configuration to customize.');
    }

    contents = contents.replace(
      debugConfigEnd,
      `        }
        release {
            if (!project.hasProperty('MYAL_RELEASE_STORE_FILE')) {
                throw new GradleException('Release signing properties are required.');
            }
            storeFile file(MYAL_RELEASE_STORE_FILE)
            storePassword MYAL_RELEASE_STORE_PASSWORD
            keyAlias MYAL_RELEASE_KEY_ALIAS
            keyPassword MYAL_RELEASE_KEY_PASSWORD
        }
    }
    buildTypes {`,
    );

    const buildTypesStart = contents.indexOf('    buildTypes {');
    const releaseBlock = /(\n        release \{\n)([\s\S]*?)(\n        \})/;
    const match = buildTypesStart < 0
      ? null
      : releaseBlock.exec(contents.slice(buildTypesStart));
    if (!match || !match[2].includes('signingConfig signingConfigs.debug')) {
      throw new Error('Could not find the generated Android release build type.');
    }
    contents = contents.replace(
      match[0],
      `${match[1]}${match[2].replace(
        'signingConfig signingConfigs.debug',
        'signingConfig signingConfigs.release',
      )}${match[3]}`,
    );

    modConfig.modResults.contents = contents;
    return modConfig;
  });
};
