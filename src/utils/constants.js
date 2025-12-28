export const PLANS = {
    basic: { name: "Starter", price: 0, maxEmployees: 1, publicVisible: false, label: "Kostenlos" },
    pro: { name: "Professional", price: 49, maxEmployees: 10, publicVisible: true, label: "49€ / Monat" },
    enterprise: { name: "Enterprise", price: 149, maxEmployees: 50, publicVisible: true, label: "149€ / Monat" }
  };
  
  export const EMP_ROLES = {
    worker: { label: "Sicherheitsmitarbeiter", canEditSchedule: false },
    team_lead: { label: "Einsatzleiter", canEditSchedule: true },
    obj_lead: { label: "Objektleiter", canEditSchedule: true }
  };