import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication, serviceName: string, port: number) {
  const config = new DocumentBuilder()
    .setTitle(`${serviceName} API`)
    .setDescription(`${serviceName} — LedgerFlow internal API`)
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
