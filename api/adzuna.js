export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée." });
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      return res.status(503).json({ error: "Configuration Adzuna incomplète : renseignez ADZUNA_APP_ID et ADZUNA_APP_KEY dans Vercel." });
    }

    const allowedCountries = new Set(["gb","fr","de","nl","be","at","ch","it","es","pl","se","no","dk","ie","pt"]);
    const country = String(req.query.country || "fr").toLowerCase();
    if (!allowedCountries.has(country)) return res.status(400).json({ error: `Code pays Adzuna non pris en charge : ${country}` });
    const query = String(req.query.q || "commercial director").trim().slice(0, 180);
    const page = Math.max(1, Math.min(5, Number.parseInt(req.query.page || "1", 10) || 1));
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
    url.searchParams.set("app_id", appId);
    url.searchParams.set("app_key", appKey);
    url.searchParams.set("results_per_page", "30");
    url.searchParams.set("what", query);
    url.searchParams.set("sort_by", "date");
    url.searchParams.set("content-type", "application/json");

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      return res.status(response.status).json({ error: `Adzuna a répondu HTTP ${response.status}. ${detail}` });
    }
    const data = await response.json();
    const offres = (Array.isArray(data.results) ? data.results : []).map((item) => ({
      id_source: item.id == null ? null : String(item.id),
      poste: item.title || "Poste non précisé",
      entreprise: item.company?.display_name || "Entreprise non précisée",
      localisation: item.location?.display_name || country.toUpperCase(),
      lien_offre: item.redirect_url || null,
      description: item.description || "",
      date_publication: item.created || null,
      salaire_min: item.salary_min ?? null,
      salaire_max: item.salary_max ?? null,
      contrat: item.contract_type || null,
      pays: country,
      source: "Adzuna"
    }));
    return res.status(200).json({ offres, total: Number(data.count || offres.length), country, query });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erreur serveur Adzuna." });
  }
}
