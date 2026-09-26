import { commonEn, commonVi } from './common';
import { navbarEn, navbarVi } from './navbar';
import { loginEn, loginVi } from './login';
import { examEn, examVi } from './exam';
import { ieltsEn, ieltsVi } from './ielts';
import { landingEn, landingVi } from './landing';
import { maintenanceEn, maintenanceVi } from './maintenance';
import { meetingEn, meetingVi } from './meeting';
import { adminSidebarEn, adminSidebarVi } from './adminSidebar';

export type Locale = 'vi' | 'en';

export const translations = {
	en: {
		common: commonEn,
		navbar: navbarEn,
		login: loginEn,
		exam: examEn,
		ielts: ieltsEn,
		landing: landingEn,
		maintenance: maintenanceEn,
		meeting: meetingEn,
		adminSidebar: adminSidebarEn
	},
	vi: {
		common: commonVi,
		navbar: navbarVi,
		login: loginVi,
		exam: examVi,
		ielts: ieltsVi,
		landing: landingVi,
		maintenance: maintenanceVi,
		meeting: meetingVi,
		adminSidebar: adminSidebarVi
	}
};
