export default async function handler(req, res) {
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      return res.status(500).json({ error: "Variables ADZUNA_APP_ID ou ADZUNA_APP_KEY manquantes sur Vercel." });
    }

    const country = (req.query.country || "fr").toLowerCase();
    const query = (req.query.q || "responsable commercial b2b").trim();
    const page = Number(req.query.page || 1);

    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
    url.searchParams.set("app_id", appId);
    url.searchParams.set("app_key", appKey);
    url.searchParams.set("results_per_page", "15");
    url.searchParams.set("what", query);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const texteErreur = await response.text();
      return res.status(response.status).json({ error: `Erreur Adzuna : ${texteErreur}` });
    }

    const data = await response.json();

    const offres = (data.results || []).map((item) => ({
      poste: item.title || "Poste non précisé",
      entreprise: item.company?.display_name || "Entreprise non précisée",
      localisation: item.location?.display_name || country.toUpperCase(),
      lien_offre: item.redirect_url || null,
      description: item.description || "",
      source: "adzuna"
    }));

    return res.status(200).json({ offres });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erreur serveur inattendue." });
  }
}
