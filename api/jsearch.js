export default async function handler(_req, res) {
  return res.status(503).json({
    offres: [],
    error: "Connecteur JSearch désactivé : l'ancienne implémentation utilisait une URL et un hôte RapidAPI invalides. Aucune offre n'a été recherchée."
  });
}
