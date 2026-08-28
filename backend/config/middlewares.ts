import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '256mb', // Batas ukuran form
      jsonLimit: '256mb', // Batas ukuran JSON
      textLimit: '256mb', // Batas ukuran Teks
      formidable: {
        maxFileSize: 256 * 1024 * 1024, // 256MB untuk upload file
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
