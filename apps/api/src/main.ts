import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Default body parser is disabled and replaced with a larger limit below —
  // /sync/push batches base64-encoded photos/signatures, which exceed
  // Express's default ~100kb JSON body limit.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "20mb" }));
  app.use(urlencoded({ extended: true, limit: "20mb" }));
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
  console.log(`FieldFlow API listening on http://localhost:${port}`);
}

bootstrap();
