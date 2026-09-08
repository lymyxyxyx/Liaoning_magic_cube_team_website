declare module "yauzl" {
  import { Readable } from "node:stream";

  type Entry = {
    fileName: string;
    uncompressedSize: number;
  };

  type ZipFile = NodeJS.EventEmitter & {
    readEntry(): void;
    openReadStream(entry: Entry, callback: (error: Error | null, stream?: Readable) => void): void;
    close(): void;
  };

  const yauzl: {
    fromBuffer(buffer: Buffer, options: { lazyEntries: boolean; validateEntrySizes?: boolean }, callback: (error: Error | null, zipFile?: ZipFile) => void): void;
  };

  export default yauzl;
}
