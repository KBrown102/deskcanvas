declare module 'ref-napi' {
  export function alloc(type: string, value?: unknown): Buffer;
  export function alloc(type: Buffer, value?: unknown): Buffer;
  export function allocCallback(retType: string, argTypes: string[], fn: (...args: unknown[]) => unknown): Buffer;
  export const NULL: Buffer;
}

declare module 'ref-struct-napi' {
  export default function Struct(fields: Record<string, unknown>): any;
}

declare module 'ffi-napi' {
  export function Library(libName: string, functions: Record<string, [string, unknown[]]>): Record<string, (...args: unknown[]) => unknown>;
  export function Callback(retType: string, argTypes: string[], fn: (...args: unknown[]) => unknown): Buffer;
}

declare module 'wallpaper' {
  export function setWallpaper(imagePath: string): Promise<void>;
  export function getWallpaper(): Promise<string>;
  export function setSolidColorWallpaper(color: [number, number, number]): Promise<void>;
  export const screens: {
    getWallpaper(): Promise<string>;
    setWallpaper(imagePath: string): Promise<void>;
  };
}

declare module 'sql.js' {
  interface QueryResults {
    columns: string[];
    values: unknown[][];
  }

  interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string, params?: unknown[]): QueryResults[];
    export(): Uint8Array;
    close(): void;
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
  export type { Database, QueryResults, SqlJsStatic, SqlJsConfig };
}
