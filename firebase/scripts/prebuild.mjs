try {
  console.log('Starting parallel prebuild tasks...');

  // Run both scripts concurrently using Promise.all
  await Promise.all([
    import('./get-firebase-remote-config.mjs'),
    import('./generate-firebase-config.mjs'),
  ]);

  console.log('All prebuild tasks completed.');
} catch (error) {
  console.error('Prebuild failed during execution.', error);
  // Exit with status 1 to tell Firebase App Hosting that the build failed
  process.exit(1);
}
