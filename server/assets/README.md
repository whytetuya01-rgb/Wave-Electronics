# Server assets

- `company-logo.png` - the WCS Wave Control System logo, drawn in the header
  of generated Delivery Challan and Job Receipt PDFs. PNG or JPEG content
  (PDFKit supports only these), scaled to fit 130 x 46 pt with its proportions
  kept. Without it, PDFs print a text-only header.

The web app's copies of the logo live in `client/src/assets/brand/` (logo and
square emblem) and `client/public/` (browser and home-screen icons), all
rendered from the same source PDF.

Vercel bundles `company-logo.png` into the API function by its exact name, so
keep that file name. The Settings page "Logo File Path" (or
`COMPANY_LOGO_PATH`) can point elsewhere on a self-hosted server; when that
path does not exist, this file is used instead.
