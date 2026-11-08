export function ReportsPage() {
  return (
    <div className="page">
      <div className="card brand-header">
        <h3 style={{ margin: 0 }}>Reports &amp; documents</h3>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Management report structure (print from browser when data is ready)
        </p>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <ol className="report-structure">
          <li>Cover &amp; executive summary</li>
          <li>Ticket volume and resolution rate</li>
          <li>SLA performance (P1–P4)</li>
          <li>Open / breached / approaching breach</li>
          <li>Officer workload</li>
          <li>Incidents and major events</li>
          <li>Device / KAVRO operations</li>
          <li>Recommendations and next actions</li>
        </ol>
        <p className="muted" style={{ marginTop: 16 }}>
          Figures are only taken from system records — never invented.
        </p>
      </div>
    </div>
  )
}
