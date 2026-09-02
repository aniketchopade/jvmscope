import AdmZip from "adm-zip";
import { join } from "node:path";
import { access } from "node:fs/promises";

/**
 * Unzips a jar into a folder tree. Spring Boot fat jars nest application classes under
 * BOOT-INF/classes and dependency jars under BOOT-INF/lib — we always unzip the outer jar,
 * and additionally explode BOOT-INF/classes in place (it's just another directory once
 * unzipped, nothing further needed) so decompilation later walks a flat classes tree.
 */
export async function explodeJar(jarPath: string, destDir: string): Promise<{ classesDir: string; isFatJar: boolean }> {
  const zip = new AdmZip(jarPath);
  zip.extractAllTo(destDir, true);

  const bootInfClasses = join(destDir, "BOOT-INF", "classes");
  try {
    await access(bootInfClasses);
    return { classesDir: bootInfClasses, isFatJar: true };
  } catch {
    return { classesDir: destDir, isFatJar: false };
  }
}

/**
 * Explodes BOOT-INF/lib/*.jar dependency jars as well. Gated behind an explicit call
 * (not automatic) since a fat jar's lib/ can hold hundreds of dependency jars and callers
 * may prefer to decompile only the application's own classes.
 */
export async function explodeDependencyJars(explodedRoot: string, destDir: string): Promise<string[]> {
  const libDir = join(explodedRoot, "BOOT-INF", "lib");
  try {
    await access(libDir);
  } catch {
    return [];
  }
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(libDir);
  const jarEntries = entries.filter((e) => e.endsWith(".jar"));
  for (const entry of jarEntries) {
    const zip = new AdmZip(join(libDir, entry));
    zip.extractAllTo(join(destDir, entry.replace(/\.jar$/, "")), true);
  }
  return jarEntries;
}
