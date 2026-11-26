export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée." });

  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: "Configuration France Travail incomplète." });
  }

  try {
    // 1. Obtenir le token OAuth2
    const tokenRes = await fetch(
      "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: "api_offresdemploiv2 o2dsoffre",
        }),
      }
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(500).json({ error: "France Travail : token refusé." });
    }

    // 2. Chercher des offres
    const query = String(req.query.q || "commercial").trim().slice(0, 180);
    const url = new URL("https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search");
    url.searchParams.set("motsCles", query);
    url.searchParams.set("range", "0-29"); // 30 résultats

    const offresRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      },
    });
    const data = await offresRes.json();

    // 3. Mapper vers le format de ton cockpit
    const offres = (data.resultats || []).map((o) => ({
      id_source: o.id,
      poste: o.intitule || "Poste non précisé",
      entreprise: o.entreprise?.nom || "Entreprise non précisée",
      localisation: o.lieuTravail?.libelle || "France",
      lien_offre: o.origineOffre?.urlOrigine || null,
      description: o.description || "",
      date_publication: o.dateCreation || null,
      salaire_min: null,
      salaire_max: null,
      contrat: o.typeContrat || null,
      pays: "fr",
      source: "France Travail",
    }));

    return res.status(200).json({ offres, total: data.resultats?.length || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erreur serveur France Travail." });
  }
}
