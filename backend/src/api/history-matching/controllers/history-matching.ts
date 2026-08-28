/**
 * history-matching controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::history-matching.history-matching',
  ({ strapi }: { strapi: any }) => ({
    async create(ctx: any) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('Anda harus login terlebih dahulu.');
      }

      // Pastikan objek data ada sebelum menambahkan user id
      if (!ctx.request.body.data) {
        ctx.request.body.data = {};
      }

      // Suntikkan ID pengguna yang sedang login ke relasi
      ctx.request.body.data.users_permissions_user = user.id;

      const response = await super.create(ctx);
      return response;
    },
  })
);