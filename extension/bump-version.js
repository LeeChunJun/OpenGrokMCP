#!/usr/bin/env node

/**
 * Bumps the minor version in package.json and package-lock.json
 * For version x.y.z, increments to x.y.(z+1)
 */

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, 'package.json');
const packageLockPath = path.join(__dirname, 'package-lock.json');

// Read package.json
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Parse current version
const versionParts = pkg.version.split('.');
const major = parseInt(versionParts[0]);
const minor = parseInt(versionParts[1]);
const patch = parseInt(versionParts[2]) || 0;

// Bump patch version
const newPatch = patch + 1;
const newVersion = `${major}.${minor}.${newPatch}`;

console.log(`📦 Bumping version: ${pkg.version} → ${newVersion}`);

// Update package.json
pkg.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

// Update package-lock.json if it exists
if (fs.existsSync(packageLockPath)) {
  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  packageLock.version = newVersion;
  fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
}

console.log(`✓ Updated to version ${newVersion}`);
process.exit(0);
