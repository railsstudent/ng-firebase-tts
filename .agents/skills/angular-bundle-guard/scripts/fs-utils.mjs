import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BOOTSTRAP_KEY = 'bootstrap';
const projectCaches = new Map();
let activeHashKey = BOOTSTRAP_KEY;

function createCacheBucket(seedBucket) {
  return {
    files: new Map(seedBucket ? seedBucket.files : []),
    exists: new Map(seedBucket ? seedBucket.exists : []),
    dirs: new Map(seedBucket ? seedBucket.dirs : []),
    mtimes: new Map(seedBucket ? seedBucket.mtimes : []),
  };
}

function getBucket(hash = activeHashKey) {
  if (!projectCaches.has(hash)) {
    projectCaches.set(hash, createCacheBucket());
  }
  return projectCaches.get(hash);
}

function toCacheKey(filePath) {
  if (filePath instanceof URL) {
    return path.resolve(fileURLToPath(filePath));
  }
  return path.resolve(String(filePath));
}

/**
 * Binds the active cache namespace to the unique project hash and promotes
 * any files read during hash computation into that hash's isolated bucket.
 */
export function setActiveProjectHash(hash) {
  const nextKey = hash || BOOTSTRAP_KEY;
  if (!projectCaches.has(nextKey)) {
    const bootstrapBucket = projectCaches.get(BOOTSTRAP_KEY);
    projectCaches.set(nextKey, createCacheBucket(bootstrapBucket));
  }
  projectCaches.delete(BOOTSTRAP_KEY);
  activeHashKey = nextKey;
}

/**
 * Clears cached filesystem state for the given hash (e.g. after running a fresh build).
 */
export function clearFsCache(hash = activeHashKey) {
  projectCaches.set(hash, createCacheBucket());
}

export function fileExists(filePath) {
  const bucket = getBucket();
  const key = toCacheKey(filePath);
  if (bucket.files.has(key)) {
    return bucket.files.get(key) !== null;
  }
  if (bucket.exists.has(key)) {
    return bucket.exists.get(key);
  }
  const exists = fs.existsSync(key);
  bucket.exists.set(key, exists);
  return exists;
}

export function readTextFile(filePath) {
  const bucket = getBucket();
  const key = toCacheKey(filePath);
  if (bucket.files.has(key)) {
    return bucket.files.get(key);
  }
  if (!fs.existsSync(key)) {
    bucket.exists.set(key, false);
    bucket.files.set(key, null);
    return null;
  }
  const content = fs.readFileSync(key, 'utf8');
  bucket.exists.set(key, true);
  bucket.files.set(key, content);
  return content;
}

export function readJsonFile(filePath, { stripComments = false } = {}) {
  const raw = readTextFile(filePath);
  if (raw === null) {
    return null;
  }
  const text = stripComments ? raw.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '') : raw;
  return JSON.parse(text);
}

export function writeTextFile(filePath, content) {
  const bucket = getBucket();
  const key = toCacheKey(filePath);
  const tmpPath = `${key}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, key);
  bucket.exists.set(key, true);
  bucket.files.set(key, content);
}

export function getFileMtimeMs(filePath) {
  const bucket = getBucket();
  const key = toCacheKey(filePath);
  if (bucket.mtimes.has(key)) {
    return bucket.mtimes.get(key);
  }
  try {
    const mtimeMs = fs.statSync(key).mtimeMs;
    bucket.exists.set(key, true);
    bucket.mtimes.set(key, mtimeMs);
    return mtimeMs;
  } catch {
    bucket.mtimes.set(key, 0);
    return 0;
  }
}

export function getSourceFiles(dir, extList = []) {
  const bucket = getBucket();
  const absDir = toCacheKey(dir);
  let allFiles = bucket.dirs.get(absDir);
  if (!allFiles) {
    if (!fileExists(absDir)) {
      allFiles = [];
    } else {
      allFiles = fs
        .readdirSync(absDir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => path.join(e.parentPath || e.path, e.name));
    }
    bucket.dirs.set(absDir, allFiles);
  }
  if (!extList || extList.length === 0) {
    return [...allFiles];
  }
  return allFiles.filter((filePath) => extList.some((ext) => filePath.endsWith(ext)));
}

export function loadSourceFilesWithContent(dir, extList = []) {
  return getSourceFiles(dir, extList).map((file) => ({
    file,
    content: readTextFile(file) ?? '',
  }));
}

export function resolveBrowserDir(statsFile) {
  const statsDir = path.dirname(statsFile);
  const browserDir = path.join(statsDir, 'browser');
  return fileExists(browserDir) ? browserDir : statsDir;
}
