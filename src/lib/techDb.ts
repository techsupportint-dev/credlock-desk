// ====================================================================
// CredLock TechDB Backend Connector
// Connected Google Sheet: TechDB
// URL: https://docs.google.com/spreadsheets/d/1wG2U2H1NCeHNEwGbxdecJ2EIODTSsDA3xRgMDOZBx5M/edit
// ====================================================================

export const TECH_DB_CONFIG = {
  spreadsheetId: '1wG2U2H1NCeHNEwGbxdecJ2EIODTSsDA3xRgMDOZBx5M',
  title: 'TechDB',
  url: 'https://docs.google.com/spreadsheets/d/1wG2U2H1NCeHNEwGbxdecJ2EIODTSsDA3xRgMDOZBx5M/edit',
  sheets: {
    tickets: 'Issue Log',
    staff: 'Staff',
    users: 'Users',
    incidents: 'Incidents',
    kavroOps: 'KAVRO Operations',
    fdxOps: 'FDX Operations',
    enrollment: 'Enrollment Log',
    notesRecommendations: 'Notes & Recommendations',
    knowledgeBase: 'Knowledge Base',
    departments: 'Departments',
    officerReports: 'Officer Reports',
  },
}

// Convert Google Sheet serial dates (e.g. 46340) to readable dates
export function parseExcelSerialDate(serial: string | number | undefined): string {
  if (!serial) return '—'
  const num = Number(serial)
  if (isNaN(num)) return String(serial)

  // Excel epoch begins Dec 30 1899
  const excelEpoch = new Date(1899, 11, 30).getTime()
  const dateMs = excelEpoch + num * 86400000
  const d = new Date(dateMs)

  try {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return String(serial)
  }
}
