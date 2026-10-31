import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data");
const seedPath = path.join(dataDirectory, "seed.json");

export class Store {
  constructor(filePath = path.join(dataDirectory, "store.json")) {
    this.filePath = path.resolve(filePath);
    if (!existsSync(this.filePath)) {
      mkdirSync(path.dirname(this.filePath), { recursive: true });
      writeFileSync(
        this.filePath,
        `${JSON.stringify(JSON.parse(readFileSync(seedPath, "utf8")), null, 2)}\n`,
        "utf8",
      );
    }
  }

  read() {
    return JSON.parse(readFileSync(this.filePath, "utf8"));
  }

  write(data) {
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, this.filePath);
  }

  update(operation) {
    const data = this.read();
    const result = operation(data);
    this.write(data);
    return result;
  }
}
