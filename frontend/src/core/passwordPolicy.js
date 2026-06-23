import { apiFetch } from './api';

let _cached = null;

export async function fetchPasswordPolicy() {
    if (_cached) return _cached;
    try {
        const data = await apiFetch('/superadmin-settings');
        _cached = {
            minPasswordLength: data?.settings?.minPasswordLength ?? 16,
            requireComplexPassword: data?.settings?.requireComplexPassword ?? true,
        };
    } catch {
        _cached = { minPasswordLength: 16, requireComplexPassword: true };
    }
    return _cached;
}

export function validatePassword(password, policy) {
    const { minPasswordLength = 16, requireComplexPassword = true } = policy || {};
    if (!password || password.length < minPasswordLength) {
        return `Le mot de passe doit contenir au moins ${minPasswordLength} caractères`;
    }
    if (requireComplexPassword) {
        if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule';
        if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule';
        if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre';
        if (!/[^A-Za-z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un symbole (!@#$…)';
    }
    return '';
}

export function generateCompliantPassword(policy) {
    const { minPasswordLength = 16 } = policy || {};
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*';
    const all = upper + lower + digits + symbols;

    // Guarantee at least one of each required class
    let pwd = [
        upper[Math.floor(Math.random() * upper.length)],
        lower[Math.floor(Math.random() * lower.length)],
        digits[Math.floor(Math.random() * digits.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
    ];
    while (pwd.length < minPasswordLength) {
        pwd.push(all[Math.floor(Math.random() * all.length)]);
    }
    // Fisher-Yates shuffle
    for (let i = pwd.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }
    return pwd.join('');
}
