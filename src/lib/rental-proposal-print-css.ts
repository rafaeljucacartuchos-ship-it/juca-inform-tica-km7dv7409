// Shared by the isolated print document and the local A4 approval preview.
export const RENTAL_PROPOSAL_PRINT_CSS = `
[data-rental-document="proposal"] {
  width:186mm!important; min-height:270mm!important; max-width:100%!important;
  display:flex!important; flex-direction:column!important;
  font-size:10pt!important; line-height:1.35!important;
}
[data-rental-document="proposal"] div,
[data-rental-document="proposal"] p,
[data-rental-document="proposal"] span,
[data-rental-document="proposal"] li,
[data-rental-document="proposal"] strong {
  font-size:inherit!important; line-height:inherit!important;
}
[data-rental-document="proposal"] h1 { font-size:13pt!important; line-height:1.2!important; }
[data-rental-document="proposal"] h2,
[data-rental-document="proposal"] h3 { font-size:10.5pt!important; line-height:1.3!important; }
[data-rental-document="proposal"] > div { margin-bottom:5mm!important; flex-shrink:0; }
[data-rental-document="proposal"] > div:first-child { gap:4mm!important; padding-bottom:4mm!important; }
[data-rental-document="proposal"] > div:first-child p { font-size:8pt!important; }
[data-rental-document="proposal"] > div:first-child > div:last-child { flex-shrink:0; }
[data-rental-document="proposal"] > div:last-child {
  margin-top:auto!important; margin-bottom:0!important; padding-top:10mm!important;
}
[data-rental-document="proposal"] .rental-customer-grid { grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:3mm!important; }
[data-rental-document="proposal"] .rental-options-two { grid-template-columns:repeat(2,minmax(0,1fr))!important; }
[data-rental-document="proposal"] .rental-option { padding:4mm!important; break-inside:avoid; }
[data-rental-document="proposal"] ul { grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:3mm!important; font-size:9pt!important; }
[data-rental-document="proposal"] .truncate { white-space:normal!important; overflow:visible!important; overflow-wrap:anywhere; }
`
