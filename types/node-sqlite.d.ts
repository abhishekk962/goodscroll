// The installed Node 20 typings predate the built-in SQLite module.
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): {
      run(...values: (string | number | null)[]): { changes: number | bigint }
      all(
        ...values: (string | number | null)[]
      ): Record<string, string | number | null>[]
      get(
        ...values: (string | number | null)[]
      ): Record<string, string | number | null> | undefined
    }
  }
}
