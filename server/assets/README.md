# Server assets

- `company-logo.png` - drawn in the header of generated Delivery Challan and
  Job Receipt PDFs. PNG or JPEG content (PDFKit supports only these), roughly
  square; it is drawn at 42 x 42 pt. Without it, PDFs print a text-only header.

Vercel bundles `company-logo.png` into the API function by its exact name, so
keep that file name. The Settings page "Logo File Path" (or
`COMPANY_LOGO_PATH`) can point elsewhere on a self-hosted server; when that
path does not exist, this file is used instead.
