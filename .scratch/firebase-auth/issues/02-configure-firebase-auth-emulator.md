# 02-configure-firebase-auth-emulator

Type: task
Status: ready-for-agent
Blocked by: None

## Description

Configure local Firebase Authentication Emulator settings inside `firebase/firebase.json` and add an ephemeral copy-execute-cleanup script to `package.json` to enable offline, zero-cloud-cost testing of sign-in, session persistence, and sign-out flows during development.

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
   - Add script using the project's existing ephemeral root copy pattern (mirroring `firebase:deploy`):

     ```json
     "firebase:emulate:auth": "cp firebase/firebase.json .; firebase emulators:start --only auth; rm firebase.json"
     ```

## Acceptance Criteria

- [ ] `firebase/firebase.json` contains `"auth": { "port": 9099 }` alongside existing emulators.
- [ ] `package.json` contains `"firebase:emulate:auth"`.
- [ ] `npm run firebase:emulate:auth` starts the Auth Emulator on port 9099 and cleans up `firebase.json` upon exit.
