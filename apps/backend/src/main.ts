import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')
  app.enableShutdownHooks()
  app.enableCors({
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  })

  const port = Number(process.env.PORT ?? 3001)
  await app.listen(port, '0.0.0.0')
}

await bootstrap()
