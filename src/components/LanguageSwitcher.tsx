import React from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className }) => {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language?.startsWith('en') ? 'en' : 'zh';

  const toggleLanguage = () => {
    const nextLang = currentLang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(nextLang);
    localStorage.setItem('lang', nextLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className={className}
      aria-label={t('common.switchLanguage')}
      title={t('common.switchLanguage')}
    >
      {currentLang === 'zh' ? 'EN' : '中文'}
    </button>
  );
};
