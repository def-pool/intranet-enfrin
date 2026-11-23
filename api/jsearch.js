export default async function handler(req, res) {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return res.status(200).json({ offres: [], warning: "Variable RAPIDAPI_KEY manquante." });
    }

    const country = (req.query.country || "fr").toLowerCase();
    const query = (req.query.q || "responsable commercial b2b").trim();
    const paysNom = { fr: "France", es: "España", be: "Belgique", ch: "Suisse" }[country] || "France";

    const url = new URL("https://rapidapi.com");
    url.searchParams.set("query", `${query} ${paysNom}`);
    url.searchParams.set("page", "1");
    url.searchParams.set("num_pages", "2");
    url.searchParams.set("country", country);
    url.searchParams.set("date_posted", "month");

    const response = await fetch(url.toString(), {
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "://rapidapi.com"
      }
    });

    if (!response.ok) {
      const errTxt = await response.text();
      return res.status(response.status).json({ error: `Erreur Agrégateur JSearch : ${errTxt}` });
    }

    const data = await response.json();

    const offres = (data.data || []).map((item) => {
      const pub = (item.job_publisher || "").toLowerCase();
      let source = item.job_publisher || "Web";
      if (pub.includes("linkedin")) source = "LinkedIn";
      else if (pub.includes("hellowork")) source = "HelloWork";
      else if (pub.includes("apec")) source = "APEC";
      else if (pub.includes("indeed")) source = "Indeed";

      return {
        poste: item.job_title || "Poste non précisé",
        entreprise: item.employer_name || "Entreprise non précisée",
        localisation: [item.job_city, item.job_country].filter(Boolean).join(", ") || paysNom,
        lien_offre: item.job_apply_link || null,
        description: item.job_description || "",
        date_publication: item.job_posted_at_datetime_utc || null,
        source
      };
    });

    return res.status(200).json({ offres });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erreur serveur JSearch." });
  }
}
