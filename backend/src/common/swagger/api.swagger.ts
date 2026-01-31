import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces';
import type { INestApplication } from '@nestjs/common';

import { MovieModule } from '../../movie/movie.module';
import { ReviewModule } from '../../review/review.module';
import { ActorModule } from '../../actor/actor.module';
import { UserModule } from '../../user/user.module';
import {
  SWAGGER_CONFIG_DATA,
  SWAGGER_SETUP_CONFIG,
  SWAGGER_SETUP_OPTIONS_DATA,
} from './swagger.constants';
import { AuthModule } from '../../auth/auth.module';

const getSwaggerDocumentConfig = (): Omit<OpenAPIObject, 'paths'> => {
  const { title, description, version, contact } = SWAGGER_CONFIG_DATA;

  return new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(version)
    .setContact(contact.name, contact.url, contact.email)
    .addBearerAuth()
    .build();
};

const SWAGGER_OPERATION_ID_FACTORY = (
  controllerKey: string,
  methodKey: string,
): string => {
  return `${controllerKey}-${methodKey}`;
};

const SWAGGER_DOCUMENT_INCLUDE_MODULES = [
  MovieModule,
  ReviewModule,
  ActorModule,
  UserModule,
  AuthModule,
];

const getSwaggerDocument = (app: INestApplication): OpenAPIObject => {
  return SwaggerModule.createDocument(app, getSwaggerDocumentConfig(), {
    include: SWAGGER_DOCUMENT_INCLUDE_MODULES,
    operationIdFactory: SWAGGER_OPERATION_ID_FACTORY,
  });
};

export const initSwaggerDocs = (app: INestApplication): void => {
  const { path } = SWAGGER_SETUP_CONFIG;

  SwaggerModule.setup(path, app, getSwaggerDocument(app), {
    ...SWAGGER_SETUP_OPTIONS_DATA,
  });
};
