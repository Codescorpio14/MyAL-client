const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const home = os.homedir();
const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(home, 'Android', 'Sdk'),
  path.join(home, 'Android', 'sdk'),
].filter(Boolean);

const sdkRoot = sdkCandidates.find((candidate) =>
  fs.existsSync(path.join(candidate, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'))
);

if (sdkRoot) {
  process.env.ANDROID_HOME = sdkRoot;
  process.env.ANDROID_SDK_ROOT = sdkRoot;
} else {
  console.warn(
    'Android SDK platform-tools (adb) were not found. Starting Expo without auto-launching an emulator.\n' +
      'Scan the QR code with Expo Go to test on a device, or install Android Studio and set ANDROID_HOME to your SDK directory.'
  );
}

const expoCli = path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');
const forwardedArgs = process.argv.slice(2);
const args = [expoCli, 'start'];
if (sdkRoot) args.push('--android');
else if (
  !forwardedArgs.some((arg) =>
    ['--host', '--lan', '--tunnel', '--localhost', '--offline'].includes(arg) ||
    arg.startsWith('--host=')
  )
) {
  args.push('--lan');
}
args.push(...forwardedArgs);

const expo = spawn(process.execPath, args, {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => expo.kill(signal));
}

expo.on('error', (error) => {
  console.error(`Could not start Expo CLI: ${error.message}`);
  process.exitCode = 1;
});

expo.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
