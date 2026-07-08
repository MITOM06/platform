// Static skill catalog — mirrors the mockup's "Skills" section and the Flutter
// `skill_defs.dart`. Display strings (name/desc) are i18n keys resolved at
// render time via `skills.<id>Name` / `skills.<id>Desc`; this file is the
// source of truth for the skill ids, their icons, and which connectors each
// one requires (provider ids, matching catalog entry `id`s).

export interface SkillDef {
  /** Stable id persisted in connector-service `user_skills`. */
  id: string
  /** Emoji shown in the skill card (matches mockup). */
  icon: string
  /** Connector provider ids this skill needs to be useful. */
  requires: string[]
}

export const SKILLS: SkillDef[] = [
  { id: 'scheduler', icon: '🗓️', requires: ['gcal', 'gmail'] },
  { id: 'mailWriter', icon: '✍️', requires: ['gmail'] },
  { id: 'researcher', icon: '📚', requires: ['gdrive'] },
  { id: 'projectKeeper', icon: '🧩', requires: ['notion'] },
  { id: 'meetingNotes', icon: '🎙️', requires: [] },
  { id: 'inboxTriage', icon: '📥', requires: ['gmail'] },
  { id: 'dataAnalyst', icon: '📊', requires: [] },
  { id: 'docDrafter', icon: '📝', requires: [] },
  { id: 'translator', icon: '🌐', requires: [] },
  { id: 'webSearch', icon: '🔍', requires: [] },
  { id: 'weatherForecast', icon: '🌤️', requires: [] },
]
