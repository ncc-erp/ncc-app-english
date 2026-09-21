import { commonEn, commonVi } from './common';
import { navbarEn, navbarVi } from './navbar';
import { loginEn, loginVi } from './login';
import { examEn, examVi } from './exam';
import { ieltsEn, ieltsVi } from './ielts';
import { landingEn, landingVi } from './landing';

export type Locale = 'vi' | 'en';

export const translations = {
  en: {
    common: commonEn,
    navbar: navbarEn,
    login: loginEn,
    exam: examEn,
    ielts: ieltsEn,
    landing: landingEn,
  },
  vi: {
    common: commonVi,
    navbar: navbarVi,
    login: loginVi,
    exam: examVi,
    ielts: ieltsVi,
    landing: landingVi,
  },
};
