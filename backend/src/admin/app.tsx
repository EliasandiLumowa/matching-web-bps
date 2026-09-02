import type { StrapiApp } from '@strapi/strapi/admin';

// Import aset gambar sesuai nama file di folder extensions
// @ts-ignore
import AuthLogo from './extensions/icon.png';
// @ts-ignore
import MenuLogo from './extensions/icon.png';
// @ts-ignore
import Favicon from './extensions/favicon.png';

export default {
  config: {
    head: {
      favicon: Favicon,
    },
    auth: {
      logo: AuthLogo,
    },
    menu: {
      logo: MenuLogo,
    },
    translations: {
      en: {
        'Auth.form.welcome.title': 'Welcome to MATCHSTAT!',
        'Auth.form.welcome.subtitle': 'Log in to your MATCHSTAT Admin account',
        'app.components.LeftMenu.navbrand.title': 'MATCHSTAT',
        'app.components.HomePage.helmet.title': 'MATCHSTAT Dashboard',
        'admin.pages.App.helmet.title': 'MATCHSTAT Admin',
        'global.default': 'MATCHSTAT',
      },
      id: {
        'Auth.form.welcome.title': 'Selamat Datang di MATCHSTAT!',
        'Auth.form.welcome.subtitle': 'Masuk ke akun Admin MATCHSTAT',
        'app.components.LeftMenu.navbrand.title': 'MATCHSTAT',
        'app.components.HomePage.helmet.title': 'Dashboard MATCHSTAT',
        'admin.pages.App.helmet.title': 'MATCHSTAT Admin',
        'global.default': 'MATCHSTAT',
      },
    },
    tutorials: false,
    notifications: { releases: false },
  },
  bootstrap(app: StrapiApp) {
    // Override browser tab title: ganti semua "Strapi" → "MATCHSTAT"
    const replaceTitle = () => {
      if (document.title.includes('Strapi')) {
        document.title = document.title.replace(/Strapi/g, 'MATCHSTAT');
      }
    };

    // Initial override
    replaceTitle();

    // Observe perubahan title yang dilakukan Strapi secara internal
    const titleEl = document.querySelector('title');
    if (titleEl) {
      const observer = new MutationObserver(replaceTitle);
      observer.observe(titleEl, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  },
};