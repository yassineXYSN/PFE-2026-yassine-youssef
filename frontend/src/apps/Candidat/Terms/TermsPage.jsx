/* HumatiQ AI — Terms of Use & Privacy Policy (RGPD/GDPR compliant) */

import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle/LanguageToggle';
import { useLanguage } from '../../../core/useLanguage';
import humatiqLogo from '../../../assets/logo/humatiqlogo.png';
import { termsContent } from './termsContent';
import './TermsPage.css';

const TermsPage = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const c = termsContent[language] || termsContent.fr;

  return (
    <div className="terms-page">
      <div className="terms-toolbar">
        <button
          type="button"
          className="terms-back-btn"
          onClick={() => navigate(-1)}
          aria-label={c.back}
        >
          <i className="fa-solid fa-arrow-left"></i>
          <span>{c.back}</span>
        </button>
        <div className="terms-toolbar-toggles">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>

      <article className="terms-content">
        <header className="terms-header">
          <img src={humatiqLogo} alt="HumatiQ" className="terms-logo" />
          <h1>{c.title}</h1>
          <p className="terms-updated">{c.lastUpdated}</p>
          <p className="terms-intro">{c.intro}</p>
        </header>

        {c.sections.map((section, i) => (
          <section key={i} className={`terms-section${section.highlight ? ' terms-highlight' : ''}`}>
            <h2>{section.heading}</h2>
            {section.paragraphs?.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {section.list && (
              <ul>
                {section.list.map((item, k) => (
                  <li key={k}>{item}</li>
                ))}
              </ul>
            )}
            {section.list2?.map((p, j) => (
              <p key={`l2-${j}`}>{p}</p>
            ))}
          </section>
        ))}

        <footer className="terms-footer">{c.footer}</footer>
      </article>
    </div>
  );
};

export default TermsPage;
