# Débloquer la création du compte administrateur

## Problème

Aucun domaine d'envoi n'est configuré pour le projet, et aucun e-mail n'apparaît dans l'historique de livraison. La création du compte reste donc bloquée en attente d'une confirmation par e-mail qui n'arrive pas.

## Solution retenue

Désactiver la confirmation d'adresse e-mail à l'inscription : le compte administrateur est créé et connecté immédiatement.

Cela reste sûr dans ce contexte : l'inscription sert uniquement à créer le compte unique de l'administration de la mairie, et le premier compte créé reçoit automatiquement le rôle admin.

## Ce qui change

1. **Réglage d'authentification** : activation de la confirmation automatique des inscriptions (auto-confirm), les autres réglages restent inchangés (inscriptions ouvertes, pas de comptes anonymes, protection contre les mots de passe compromis conservée).
2. **Page de connexion** (`src/routes/auth.tsx`) : après une inscription réussie, redirection directe vers le tableau de bord ; suppression du message « Vérifiez votre boîte mail ».

## Point de vigilance

Sans confirmation e-mail, la réinitialisation de mot de passe par e-mail ne fonctionnera pas tant que le domaine d'envoi (Mairie-rodez.fr) n'est pas configuré. Si vous souhaitez plus tard des e-mails officiels (invitations, réinitialisation), il faudra configurer ce domaine.

## Détails techniques

- `supabase--configure_auth` avec `auto_confirm_email: true`, `disable_signup: false`, `external_anonymous_users_enabled: false`, `password_hibp_enabled: true`.
- Dans `onSubmit` de `AuthPage`, la branche `signup` navigue vers `/tableau-de-bord` (la session est désormais toujours renvoyée par `signUp`).
