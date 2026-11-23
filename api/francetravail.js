export default async function handler(req, res) {
  try {
    const clientId = process.env.FT_CLIENT_ID;
    const clientSecret = process.env.FT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(200).json({ offres: [], warning: "Variables FT_CLIENT_ID ou FT_CLIENT_SECRET manquantes." });
    }

    const query = (req.query.q || "responsable commercial b2b").trim();

    const authRes = await fetch(
      "https://francetravail.fr",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: "api_offresdemploiv2 o2dsoffre"
        })
      }
    );

    if (!authRes.ok) {
      const errTxt = await authRes.text();
      return res.status(authRes.status).json({ error: `Erreur Auth France Travail : ${errTxt}` });
    }

    const { access_token } = await authRes.json();

    const searchUrl = new URL("https://francetravail.io");
    searchUrl.searchParams.set("motsCles", query);
    searchUrl.searchParams.set("range", "0-29");
    searchUrl.searchParams.set("sort", "1");

    const offersRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    if (!offersRes.ok && offersRes.status !== 204) {
      const errTxt = await offersRes.text();
      return res.status(offersRes.status).json({ error: `Erreur Recherche France Travail : ${errTxt}` });
    }

    const data = offersRes.status === 204 ? { resultats: [] } : await offersRes.json();

    const offres = (data.resultats || []).map((item) => ({
      poste: item.intitule || "Poste non précisé",
      entreprise: item.entreprise?.nom || "Entreprise confidentielle",
      localisation: item.lieuTravail?.libelle || "France",
      lien_offre: item.origineOffre?.urlOrigine || `https://francetravail.fr{item.id}`,
      description: item.description || "",
      date_publication: item.dateCreation || null,
      source: "France Travail"
    }));

    return res.status(200).json({ offres });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erreur serveur France Travail." });
  }
}
