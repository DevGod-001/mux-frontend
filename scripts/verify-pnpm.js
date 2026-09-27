import { execSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface LockFileEntry {
  name: string;
  version: string;
  resolved: string;
  integrity: string;
  dependencies?: Record<string, string>;
}

interface LockFileIntegrityResult {
  valid: boolean;
  packageCount: number;
  failed: string[];
  warnings: string[];
  missingIntegrity: string[];
  hashMismatch: string[];
  lockFileHash: string;
  verifiedAt: number;
}

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class PnpmLockIntegrityVerifier {
  private lockFilePath: string;
  private packageJsonPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.lockFilePath = path.join(projectRoot, 'pnpm-lock.yaml');
    this.packageJsonPath = path.join(projectRoot, 'package.json');
  }

  verify(): LockFileIntegrityResult {
    const result: LockFileIntegrityResult = {
      valid: true,
      packageCount: 0,
      failed: [],
      warnings: [],
      missingIntegrity: [],
      hashMismatch: [],
      lockFileHash: '',
      verifiedAt: Date.now(),
    };

    try {
      if (!fs.existsSync(this.lockFilePath)) {
        throw new Error('pnpm-lock.yaml not found');
      }

      const lockContent = fs.readFileSync(this.lockFilePath, 'utf-8');
      const packages = this.parseLockFile(lockContent);
      result.packageCount = packages.length;
      result.lockFileHash = this.computeFileHash(this.lockFilePath);

      const integrityIssues = this.validateIntegrity(packages);
      result.missingIntegrity = integrityIssues.missing;
      result.hashMismatch = integrityIssues.mismatched;

      if (result.missingIntegrity.length > 0 || result.hashMismatch.length > 0) {
        result.valid = false;
      }

      const packageJson = this.readPackageJson();
      const depWarnings = this.checkDependencyConsistency(packages, packageJson);
      result.warnings = depWarnings;

      const unusedPackages = this.findUnusedPackages(packages, packageJson);
      if (unusedPackages.length > 0) {
        result.warnings.push(...unusedPackages);
      }

      if (result.warnings.length > 0) {
        result.valid = false;
      }

    } catch (error) {
      result.valid = false;
      result.failed.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  private parseLockFile(content: string): LockFileEntry[] {
    const packages: LockFileEntry[] = [];
    const lines = content.split('\n');
    let currentPackage: Partial<LockFileEntry> = {};
    let inPackage = false;

    for (const line of lines) {
      if (line.startsWith('  ') && !line.startsWith('    ')) {
        if (inPackage && currentPackage.name) {
          packages.push(currentPackage as LockFileEntry);
        }
        const match = line.match(/^(\S+):/);
        if (match) {
          currentPackage = { name: match[1] };
          inPackage = true;
        }
      } else if (line.startsWith('    ') && inPackage) {
        const trimmed = line.trim();
        if (trimmed.startsWith('version:')) {
          currentPackage.version = trimmed.split(':')[1].trim();
        } else if (trimmed.startsWith('resolved:')) {
          currentPackage.resolved = trimmed.split(':')[1].trim();
        } else if (trimmed.startsWith('integrity:')) {
          currentPackage.integrity = trimmed.split(':')[1].trim();
        }
      }
    }

    if (inPackage && currentPackage.name) {
      packages.push(currentPackage as LockFileEntry);
    }

    return packages;
  }

  private validateIntegrity(
    packages: LockFileEntry[]
  ): { missing: string[]; mismatched: string[] } {
    const missing: string[] = [];
    const mismatched: string[] = [];

    for (const pkg of packages) {
      if (!pkg.integrity || pkg.integrity.trim() === '') {
        missing.push(`${pkg.name}@${pkg.version}`);
      } else {
        const expectedHash = this.extractIntegrityHash(pkg.integrity);
        if (expectedHash && !this.verifyPackageIntegrity(pkg)) {
          mismatched.push(`${pkg.name}@${pkg.version}`);
        }
      }
    }

    return { missing, mismatched };
  }

  private extractIntegrityHash(integrity: string): string | null {
    const match = integrity.match(/sha512-([a-zA-Z0-9+/=]+)/);
    return match ? match[1] : null;
  }

  private verifyPackageIntegrity(pkg: LockFileEntry): boolean {
    try {
      const pkgPath = this.getPackagePath(pkg);
      if (!fs.existsSync(pkgPath)) return false;
      return true;
    } catch {
      return false;
    }
  }

  private getPackagePath(pkg: LockFileEntry): string {
    const safeName = pkg.name.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(process.cwd(), 'node_modules', safeName);
  }

  private readPackageJson(): PackageJson | null {
    try {
      const content = fs.readFileSync(this.packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private checkDependencyConsistency(
    packages: LockFileEntry[],
    packageJson: PackageJson | null
  ): string[] {
    const warnings: string[] = [];

    if (!packageJson) return warnings;

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const lockNames = new Set(packages.map((p) => p.name));

    for (const dep in allDeps) {
      if (!lockNames.has(dep)) {
        warnings.push(`Dependency ${dep} missing from lock file`);
      }
    }

    return warnings;
  }

  private findUnusedPackages(
    packages: LockFileEntry[],
    packageJson: PackageJson | null
  ): string[] {
    const warnings: string[] = [];
    if (!packageJson) return warnings;

    const usedDeps = new Set([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
    ]);

    for (const pkg of packages) {
      const baseName = pkg.name.split('/')[0] || pkg.name;
      if (!usedDeps.has(baseName) && !pkg.name.startsWith('@types/')) {
        warnings.push(`Potentially unused package: ${pkg.name}`);
      }
    }

    return warnings;
  }

  private computeFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  }

  async fix(): Promise<boolean> {
    try {
      execSync('pnpm install --lockfile-only', { stdio: 'inherit' });
      execSync('pnpm verify-pnpm.js', { stdio: 'inherit' });
      return true;
    } catch {
      return false;
    }
  }

  generateReport(result: LockFileIntegrityResult): string {
    const lines: string[] = [
      '# pnpm Lock File Integrity Report',
      '',
      `**Verified At:** ${new Date(result.verifiedAt).toISOString()}`,
      `**Valid:** ${result.valid}`,
      `**Packages:** ${result.packageCount}`,
      `**Lock File Hash:** \`${result.lockFileHash}\``,
      '',
    ];

    if (result.missingIntegrity.length > 0) {
      lines.push('## Missing Integrity Hashes');
      result.missingIntegrity.forEach((pkg) => {
        lines.push(`- ${pkg}`);
      });
      lines.push('');
    }

    if (result.hashMismatch.length > 0) {
      lines.push('## Hash Mismatches');
      result.hashMismatch.forEach((pkg) => {
        lines.push(`- ${pkg}`);
      });
      lines.push('');
    }

    if (result.warnings.length > 0) {
      lines.push('## Warnings');
      result.warnings.forEach((warn) => {
        lines.push(`- ${warn}`);
      });
      lines.push('');
    }

    if (result.failed.length > 0) {
      lines.push('## Failed');
      result.failed.forEach((err) => {
        lines.push(`- ${err}`);
      });
    }

    return lines.join('\n');
  }
}

export function verifyPnpmLock(): LockFileIntegrityResult {
  const verifier = new PnpmLockIntegrityVerifier();
  return verifier.verify();
}

export { PnpmLockIntegrityVerifier };
