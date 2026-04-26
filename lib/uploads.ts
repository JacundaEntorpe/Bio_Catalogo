import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function saveImageFile(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name) || ".bin";
  const folderName = new Date().toISOString().slice(0, 10);
  const targetDirectory = path.join(process.cwd(), "public", "uploads", folderName);

  await mkdir(targetDirectory, { recursive: true });

  const storedFileName = `${randomUUID()}${extension.toLowerCase()}`;
  const diskPath = path.join(targetDirectory, storedFileName);

  await writeFile(diskPath, bytes);

  return {
    fileName: file.name,
    storagePath: `/uploads/${folderName}/${storedFileName}`
  };
}