'use client';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { HeaderTitle } from '../HeaderTitle';
import CreateHomeworkButton from './CreateHomeWorkModal';

export default function HomeworkLayout({
	children
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { t, locale } = useTranslation();

	return (
		<main className='flex-1 w-full min-w-0 flex flex-col'>
			<HeaderTitle
				title='Homework Management'
				description='Create homework for each part and organize assignments by topic for focused practice.'
				action={<CreateHomeworkButton />}
			/>
			{children}
		</main>
	);
}
