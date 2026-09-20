import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import postgres from 'postgres'

@Injectable()
export class Database implements OnApplicationShutdown {
  readonly sql: ReturnType<typeof postgres>

  constructor() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
    this.sql = postgres(process.env.DATABASE_URL, { max: 10, idle_timeout: 30 })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.sql.end()
  }
}
