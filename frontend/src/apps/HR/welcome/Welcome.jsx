import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import './Welcome.css';

const Welcome = () => {
    const { effectiveTheme } = useTheme();
    const navigate = useNavigate();

    const handleStart = () => {
        navigate('/hr/create-company');
    };

    return (
        <div className={`welcome-page ${effectiveTheme === 'dark' ? 'dark' : ''}`}>
            {/* Background Decorative Element */}
            <div className="welcome-bg-gradient">
                <div className="welcome-blob-1"></div>
                <div className="welcome-blob-2"></div>
            </div>

            <main className="welcome-main">
                <div className="welcome-container">
                    <div className="welcome-icon-wrapper">
                        <span className="material-symbols-outlined welcome-icon">waving_hand</span>
                    </div>

                    <h1 className="welcome-title">Bienvenue sur HumatiQ</h1>

                    <p className="welcome-text">
                        Nous sommes ravis de vous compter parmi nous. HumatiQ va vous aider à gérer vos recrutements de manière moderne, fluide et efficace.
                    </p>

                    <p className="welcome-subtext">
                        Prenons deux petites minutes pour configurer votre base de travail. Les informations de votre entreprise permettront de personnaliser vos offres d'emploi et d'offrir une meilleure expérience aux candidats.
                    </p>

                    <button className="welcome-btn" onClick={handleStart}>
                        <span>Configurer mon entreprise</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>

                    <div className="welcome-footer-info">
                        <span className="material-symbols-outlined">verified_user</span>
                        <span>Configuration rapide et sécurisée</span>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Welcome;
