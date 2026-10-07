# 02-configure-firebase-auth-emulator

Type: task
Status: done
Blocked by: None

## Description

Configure local Firebase Authentication Emulator settings inside `firebase/firebase.json` and add a script to `package.json` using the native `--config firebase/firebase.json` flag to enable offline, zero-cloud-cost testing of sign-in, session persistence, and sign-out flows during development without root file copying or cleanup.

## Target Files

- `firebase/firebase.json`
- `package.json`

## Specifications & Requirements

1. **Update `firebase/firebase.json`**:
   - Add `"auth"` block under `"emulators"` with port `9099`.
   - Preserve existing `"apphosting"` and `"ui"` emulator configurations.

   ```json
   {
     "apphosting": [
       {
         "backendId": "ng-firebase-tts",
         "rootDir": "..",
         "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log", "functions"]
       }
     ],
     "remoteconfig": {
       "template": "remote-config-template.json"
     },
     "emulators": {
       "auth": {
         "port": 9099
       },
       "apphosting": {
         "port": 5005,
         "rootDirectory": "..",
         "startCommand": "npm run start"
       },
       "ui": {
         "enabled": true
       }
     }
   }
   ```

2. **Add NPM Script in `package.json`**:
   - Add/update script using the native Firebase `--config` flag:

     ```json
     "firebase:emulate:auth": "firebase --config firebase/firebase.json emulators:start --only auth"
     ```

## Acceptance Criteria

- [x] `firebase/firebase.json` contains `"auth": { "port": 9099 }` alongside existing emulators.
- [x] `package.json` contains `"firebase:emulate:auth": "firebase --config firebase/firebase.json emulators:start --only auth"`.
- [x] Running `npm run firebase:emulate:auth` starts the Auth Emulator on port 9099 without requiring root file copies or cleanup.
