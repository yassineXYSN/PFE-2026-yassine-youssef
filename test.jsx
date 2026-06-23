// Login.jsx — handleSubmit (extrait simplifie)
// La connexion est geree entierement cote frontend via le SDK Supabase.

const handleSubmit = async (e) => {
  e.preventDefault();

  // 1. Authentification directe avec Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (authError) {
    setError("Email ou mot de passe incorrect.");
    return;
  }

  // 2. Recuperation du profil metier depuis FastAPI
  const profileData = await apiFetch(
    `/profiles/${authData.user.id}`
  );

  // 3. Blocage si le compte est en attente de validation
  if (profileData.status === "pending") {
    navigate("/hr/verify-email", {
      state: { email: authData.user.email }
    });
    return;
  }

  // 4. Notification post-connexion (fire-and-forget)
  await apiFetch("/auth/notify-login", { method: "POST" });

  // 5. Persistance du role en session
  localStorage.setItem("userRole", profileData.role);

  // 6. Verification MFA pour les roles privilegies
  const { data: aalData } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (
    aalData?.nextLevel === "aal2" &&
    aalData.nextLevel !== aalData.currentLevel
  ) {
    navigate("/hr/otp", {
      state: { mfaContext: profileData.role }
    });
    return;
  }

  // 7. Redirection selon le role
  navigate(
    profileData.role === "superadmin"
      ? "/superadmin/dashboard"
      : "/hr/dashboard"
  );
};