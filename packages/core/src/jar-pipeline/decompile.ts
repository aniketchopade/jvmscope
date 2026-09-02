import { execa } from "execa";
import AdmZip from "adm-zip";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

export interface DecompileOptions {
  cfrJarPath: string;
  javaBin?: string;
  /** Called with each decompiled class's fully-qualified name, to drive a progress indicator. */
  onProgress?: (className: string) => void;
}

/**
 * CFR prints one `Processing <fqcn>` line per class as it works — on **stderr**, not stdout.
 * Its first line names the archive itself ("Processing <path>.jar (use silent to silence)")
 * rather than a class, so that one is filtered out of the progress count.
 */
const PROCESSING_LINE = /^Processing\s+(\S+)\s*$/;

/**
 * Decompiles a jar to readable .java via CFR (an open-source single-jar CLI decompiler,
 * invoked as a subprocess since it's a Java tool, not npm-installable).
 *
 * Note CFR only accepts a .jar or .class file as input — pointing it at a directory fails
 * with "CannotLoadClassException ... Access is denied". Use decompileClassesDir below when
 * you have a directory of classes (e.g. a Spring Boot fat jar's BOOT-INF/classes).
 */
export async function decompileJar(jarPath: string, outDir: string, options: DecompileOptions): Promise<number> {
  const javaBin = options.javaBin ?? "java";
  const subprocess = execa(javaBin, ["-jar", options.cfrJarPath, jarPath, "--outputdir", outDir]);

  let count = 0;
  subprocess.stderr?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString("utf-8").split("\n")) {
      const match = PROCESSING_LINE.exec(line.trim());
      if (match && !isArchivePath(match[1])) {
        count++;
        options.onProgress?.(match[1]);
      }
    }
  });

  await subprocess;
  return count;
}

/**
 * Decompiles a directory of .class files by first packing them into a temporary jar, since
 * CFR cannot read a directory directly. This is the path used for Spring Boot fat jars,
 * whose application classes live under BOOT-INF/classes rather than at the jar root.
 */
export async function decompileClassesDir(classesDir: string, outDir: string, options: DecompileOptions): Promise<number> {
  const stagingDir = await mkdtemp(join(tmpdir(), "jvmscope-cfr-"));
  const tempJarPath = join(stagingDir, "classes.jar");

  const zip = new AdmZip();
  zip.addLocalFolder(classesDir);
  zip.writeZip(tempJarPath);

  return decompileJar(tempJarPath, outDir, options);
}

function isArchivePath(token: string): boolean {
  return token.endsWith(".jar") || token.includes("/") || token.includes("\\");
}
