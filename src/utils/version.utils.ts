import { readFileSync } from 'fs';
import { join } from 'path';

export function getVersionFromPackage(): string {
  try {
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch {
    throw new Error('Could not read package version');
  }
}
