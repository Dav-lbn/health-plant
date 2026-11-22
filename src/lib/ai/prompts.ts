import { CARE_LABELS, CARE_TYPES, EXPOSURE_LABELS, PHOTO_KIND_LABELS, STATE_LABELS } from '../types';
import type { CareType, Exposure, HealthState, PhotoKind } from '../types';
import { season } from '../season';

export interface DiagnosisContext {
  plantName: string;
  species: string | null;
  exposure: Exposure | null;
  waterAmountMl: number | null;
  recentCare: { type: CareType; date: string }[];
  today: string;
  previous: { date: string; summary: string; state: HealthState } | null;
  photoKinds: PhotoKind[];
  hasPreviousPhoto: boolean;
  answers: { question: string; answer: string }[];
}

const SCHEMA = `{
  "state": "bon" | "surveiller" | "malade",
  "summary": "2 à 3 phrases sur l'état général",
  "problems": [{ "name": "nom court", "cause": "cause probable", "severity": "faible" | "moyenne" | "forte" }],
  "actions": [{ "action": "action concrète", "careType": ${CARE_TYPES.map((t) => `"${t}"`).join(' | ')} | null, "priority": "haute" | "moyenne" | "basse", "delayDays": nombre de jours avant d'agir (0 = aujourd'hui) }],
  "confidence": nombre entre 0 et 1,
  "questions": ["question courte"],
  "trend": "mieux" | "stable" | "moins-bien" | "inconnue",
  "suggestedSpecies": "nom latin" | null
}`;

export function buildDiagnosisPrompt(ctx: DiagnosisContext): string {
  const lines: string[] = [];
  lines.push(
    'Tu es un botaniste expert en plantes d’intérieur et de balcon. Analyse les photos de cette plante et pose un diagnostic de santé précis et prudent.',
  );
  lines.push('');
  lines.push('Photos fournies, dans cet ordre :');
  ctx.photoKinds.forEach((k, i) => lines.push(`${i + 1}. ${PHOTO_KIND_LABELS[k]}`));
  if (ctx.hasPreviousPhoto) {
    lines.push(`${ctx.photoKinds.length + 1}. Vue d’ensemble lors du diagnostic précédent (photo précédente, pour comparer l’évolution)`);
  }
  lines.push('');
  lines.push('Contexte :');
  lines.push(`- Nom donné : ${ctx.plantName}`);
  lines.push(`- Espèce : ${ctx.species ?? 'inconnue (propose-la dans suggestedSpecies)'}`);
  lines.push(`- Exposition : ${ctx.exposure ? EXPOSURE_LABELS[ctx.exposure] : 'non renseignée'}`);
  lines.push(`- Quantité d’eau habituelle : ${ctx.waterAmountMl != null ? `${ctx.waterAmountMl} mL` : 'non renseignée'}`);
  lines.push(`- Date du jour : ${ctx.today} (saison : ${season(ctx.today)}, hémisphère nord)`);
  if (ctx.recentCare.length) {
    lines.push('- Soins des 30 derniers jours : ' + ctx.recentCare.map((c) => `${CARE_LABELS[c.type]} le ${c.date}`).join(', '));
  } else {
    lines.push('- Aucun soin enregistré ces 30 derniers jours');
  }
  if (ctx.previous) {
    lines.push(`- Diagnostic précédent (${ctx.previous.date}) : ${STATE_LABELS[ctx.previous.state]} — ${ctx.previous.summary}`);
    lines.push('  Indique dans "trend" si la plante va mieux, pareil ou moins bien.');
  } else {
    lines.push('- Pas de diagnostic précédent : "trend" = "inconnue".');
  }
  if (ctx.answers.length) {
    lines.push('');
    lines.push('Réponses de l’utilisateur à tes questions :');
    for (const a of ctx.answers) lines.push(`- ${a.question} → ${a.answer}`);
    lines.push('Tiens-en compte et donne maintenant ton diagnostic final, sans nouvelle question.');
  }
  lines.push('');
  lines.push('Règles :');
  lines.push('- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, selon ce schéma (clés en anglais, textes en français) :');
  lines.push(SCHEMA);
  lines.push('- 1 à 5 actions concrètes, adaptées à la saison, de la plus urgente à la moins urgente.');
  lines.push('- "careType" : le type de soin correspondant à l’action, ou null si aucun ne correspond.');
  lines.push(
    ctx.answers.length
      ? '- "questions" : liste vide.'
      : '- Si ta confiance est inférieure à 0.6, ajoute 1 à 3 questions courtes et simples (réponse oui/non si possible) qui t’aideraient à trancher ; sinon liste vide.',
  );
  lines.push('- Si la plante est en bonne santé, dis-le simplement et propose des soins d’entretien.');
  return lines.join('\n');
}

export function buildSpeciesPrompt(name: string, species: string | null): string {
  return [
    'Tu es un botaniste expert. À partir de la photo (si fournie) et des informations ci-dessous, rédige la fiche d’entretien de cette plante.',
    `- Nom donné : ${name}`,
    `- Espèce indiquée : ${species ?? 'inconnue — identifie-la'}`,
    '',
    'Réponds UNIQUEMENT avec un objet JSON valide (clés en anglais, textes courts en français) :',
    `{
  "species": "nom latin (nom commun)",
  "light": "besoins en lumière",
  "water": "besoins en eau et fréquence",
  "humidity": "humidité idéale",
  "temperature": "températures idéales",
  "toxicity": "toxicité pour humains et animaux",
  "tips": ["3 à 5 conseils"],
  "frequencies": { "arrosage": jours, "engrais": jours, "rempotage": jours, "taille": jours }
}`,
    'Les fréquences sont des nombres de jours en période de croissance ; omets une fréquence si elle ne s’applique pas.',
  ].join('\n');
}
