// Route Vercel : lit Gmail (lecture seule) et classe les mails de candidature.
// Variables Vercel : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, COCKPIT_KEY
const RULES = [
  ['Refusé', /malheureusement|n.avons pas retenu|ne pas donner suite|unfortunately|not (?:been )?selected|regret to inform|not moving forward|lamentamos/i],
  ['Offre reçue', /offre de poste|job offer|promesse d.embauche|pleased to offer|oferta de trabajo/i],
  ['Entretien', /entretien|interview|disponibilit|availability|schedule a call|rendez-vous|entrevista/i],
  ['Postulé', /candidature|thank you for applying|application (?:received|submitted)|accus[ée] de r[ée]ception|solicitud/i]
];
const PLATFORMS = /indeed|linkedin|welcometothejungle|workday|greenhouse|lever|smartrecruiters|taleo|jobs?\./i;

function company(from, subject) {
  const name = (from.match(/^"?([^"<]+?)"?\s*</) || [])[1] || '';
  const dom = (from.match(/@([\w.-]+)/) || [])[1] || '';
  if (PLATFORMS.test(dom)) {
    const m = subject.match(/(?:chez|at|à|pour|to)\s+([^\-–|:,!?]+)/i);
    if (m) return m[1].trim();
  }
  const clean = name.replace(/\b(careers?|recrutement|recruiting|talent|rh|jobs?|hr|team|noreply|no-reply)\b/ig, '').replace(/[-–|]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || dom.split('.').slice(-2, -1)[0] || '';
}
const poste = s => ((s.match(/(?:poste de|poste d.|position of|for the|pour le poste de|role of)\s+([^\-–|:!?]+)/i) || [])[1] || '').trim();

module.exports = async (req, res) => {
  if (!process.env.COCKPIT_KEY || req.headers['x-cockpit-key'] !== process.env.COCKPIT_KEY) {
    return res.status(401).json({ error: 'Clé cockpit refusée' });
  }
  try {
    const since = /^\d{4}-\d{2}-\d{2}$/.test(req.query.since || '') ? req.query.since.replace(/-/g, '/') : '2026/04/01';
    const tk = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    }).then(r => r.json());
    if (!tk.access_token) return res.status(500).json({ error: 'Google : ' + (tk.error || 'jeton refusé') + ' (refresh token expiré ?)' });

    const H = { Authorization: 'Bearer ' + tk.access_token };
    const G = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
    const q = encodeURIComponent(`after:${since} (candidature OR application OR entretien OR interview OR "thank you for applying" OR solicitud)`);
    const ids = []; let page = '';
    do {
      const l = await fetch(`${G}?q=${q}&maxResults=100${page}`, { headers: H }).then(r => r.json());
      ids.push(...(l.messages || []));
      page = l.nextPageToken ? '&pageToken=' + l.nextPageToken : '';
    } while (page && ids.length < 150);

    const out = [];
    for (let i = 0; i < ids.length; i += 15) {
      await Promise.all(ids.slice(i, i + 15).map(async m => {
        const d = await fetch(`${G}/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, { headers: H }).then(r => r.json());
        const h = n => ((d.payload && d.payload.headers) || []).find(x => x.name === n)?.value || '';
        const sujet = h('Subject');
        const rule = RULES.find(r => r[1].test(sujet + ' ' + (d.snippet || '')));
        if (!rule) return;
        out.push({ entreprise: company(h('From'), sujet), poste: poste(sujet), statut: rule[0], date: new Date(+d.internalDate).toISOString().slice(0, 10), sujet, thread_id: d.threadId });
      }));
    }
    res.status(200).json({ evenements: out.filter(e => e.entreprise) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
