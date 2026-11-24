export default async function handler(_req, res) {
  return res.status(503).json({
    offres: [],
    error: "Connecteur France Travail non configuré : l'ancienne implémentation utilisait des points d'accès invalides. Aucune offre n'a été recherchée."
  });
}
