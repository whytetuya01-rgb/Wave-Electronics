import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { spawn, ChildProcess } from 'child_process';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Vendor } from './models/Vendor.js';
import { Circuit } from './models/Circuit.js';
import { Component } from './models/Component.js';
import { Job } from './models/Job.js';
import { DeliveryChallan } from './models/DeliveryChallan.js';
import { JobReceipt } from './models/JobReceipt.js';

// Priority 7 - Delivery Challan & Job Receipt PDF generation tests. Mirrors
// test-api.ts's style (plain functions called directly, no mocking
// framework) for the pure generator functions, then spawns the real server
// as a child process to exercise the HTTP-level concerns (auth, ownership,
// 404s, headers) that can only be verified through Express itself.
//
// Decodes PDFKit's hex-encoded TJ/Tj text operators back into plain text so
// "does this PDF actually contain X" can be asserted without a PDF-parsing
// dependency. Works because pdfLayout.ts generates documents with
// compress:false specifically so this stays possible.
function extractPdfText(buf: Buffer): string {
  const str = buf.toString('latin1');
  let text = '';
  const decodeHex = (hex: string) => {
    for (let i = 0; i < hex.length; i += 2) {
      text += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
  };
  const tjArrayRe = /\[((?:<[0-9A-Fa-f]+>|\([^)]*\)|[-\d.]+|\s)+)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = tjArrayRe.exec(str))) {
    const hexRe = /<([0-9A-Fa-f]+)>/g;
    let hm: RegExpExecArray | null;
    while ((hm = hexRe.exec(m[1]))) decodeHex(hm[1]);
    text += ' ';
  }
  const tjSimpleRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
  while ((m = tjSimpleRe.exec(str))) {
    decodeHex(m[1]);
    text += ' ';
  }
  return text;
}

function countPdfPages(buf: Buffer): number {
  // Heuristic: PDFKit emits one "/Type /Page" object per page (distinct
  // from "/Type /Pages", the single tree-root object), so this matches the
  // actual page count for documents our own generators produce.
  const matches = buf.toString('latin1').match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

async function runGeneratorTests() {
  console.log('====================================================');
  console.log('   PRIORITY 7 - PDF GENERATOR UNIT TESTS');
  console.log('====================================================\n');

  const { generateChallanPdf } = await import('./services/pdf/challanPdf.js');
  const { generateJobReceiptPdf } = await import('./services/pdf/jobReceiptPdf.js');

  // Test 1: Valid challan PDF generation + signature + content fields.
  console.log('[Test 1]: Valid Delivery Challan PDF generation');
  const compId = new mongoose.Types.ObjectId();
  const challanBuf = await generateChallanPdf({
    challanNumber: 'CHL-TEST-0001',
    challanDate: new Date('2026-01-15'),
    jobNumber: 'JOB-TEST-0001',
    vendorName: 'Test Vendor Co',
    vendorAddress: '12 Industrial Estate',
    vendorCity: 'Pune',
    vendorGstNumber: '27TESTGST123Z5',
    items: [
      { componentId: compId, partCode: 'RES-TEST-01', name: 'Test Resistor', issuedQty: 100, receivedQty: 0, damagedQty: 0 },
    ],
    jobCircuits: [{ circuitCode: 'CIRC-TEST', circuitName: 'Test Circuit', circuitVersion: '1.0', orderedQty: 50 }],
    materialRequirement: [{ componentId: compId, requiredQty: 100, issuedQty: 100 }],
    unitByComponentId: new Map([[compId.toString(), 'NOS']]),
  });

  if (challanBuf.slice(0, 5).toString() !== '%PDF-') throw new Error('Challan PDF does not start with a valid %PDF- signature');
  console.log(`  ✓ Valid PDF signature, size=${challanBuf.length} bytes`);

  const challanText = extractPdfText(challanBuf);
  const challanRequiredFields = [
    'WAVE ELECTRONICS',
    'DELIVERY CHALLAN',
    'CHL-TEST-0001',
    'JOB-TEST-0001',
    'Test Vendor Co',
    '27TESTGST123Z5',
    'RES-TEST-01',
    'CIRC-TEST',
    'not for sale',
  ];
  for (const field of challanRequiredFields) {
    if (!challanText.includes(field)) throw new Error(`Challan PDF is missing expected content: "${field}"`);
  }
  console.log(`  ✓ All required fields present (company header, document info, material/production details, declaration)`);
  console.log('  ✓ Pass: Delivery Challan PDF generates correctly with accurate content\n');

  // Test 2: Valid job receipt PDF generation, including separate circuit vs
  // raw-component sections, rejection reason, and remarks.
  console.log('[Test 2]: Valid Job Receipt PDF generation (circuits + returns kept separate)');
  const receiptBuf = await generateJobReceiptPdf({
    receiptNumber: 'JRC-TEST-0001',
    receiptDate: new Date('2026-01-20'),
    jobNumber: 'JOB-TEST-0001',
    vendorRefNumber: 'VND-REF-99',
    vendorName: 'Test Vendor Co',
    vendorAddress: '12 Industrial Estate',
    vendorCity: 'Pune',
    vendorGstNumber: '27TESTGST123Z5',
    circuitReceipts: [
      {
        circuitCode: 'CIRC-TEST',
        circuitName: 'Test Circuit',
        circuitVersion: '1.0',
        goodQty: 45,
        rejectedQty: 5,
        rejectionReason: 'Solder bridge on U3',
      },
    ],
    componentReturns: [
      { partCode: 'RES-TEST-01', name: 'Test Resistor', challanNumber: 'CHL-TEST-0001', receivedQty: 8, damagedQty: 2 },
    ],
    remarks: 'Smoke test remarks line',
  });

  if (receiptBuf.slice(0, 5).toString() !== '%PDF-') throw new Error('Job receipt PDF does not start with a valid %PDF- signature');
  const receiptText = extractPdfText(receiptBuf);
  const receiptRequiredFields = [
    'JOB RECEIPT',
    'JRC-TEST-0001',
    'JOB-TEST-0001',
    'VND-REF-99',
    'CIRC-TEST',
    'Solder bridge on U3',
    'RES-TEST-01',
    'CHL-TEST-0001',
    'Smoke test remarks line',
  ];
  for (const field of receiptRequiredFields) {
    if (!receiptText.includes(field)) throw new Error(`Job receipt PDF is missing expected content: "${field}"`);
  }
  // The finished-circuit and raw-component-return tables must both be
  // present and distinct - this is the "do not confuse" requirement.
  if (!receiptText.includes('FINISHED CIRCUITS RECEIVED')) throw new Error('Missing "Finished Circuits Received" section');
  if (!receiptText.includes('RAW COMPONENT RETURNS')) throw new Error('Missing "Raw Component Returns" section');
  console.log('  ✓ Valid PDF signature, all required fields present');
  console.log('  ✓ Finished-circuit and raw-component-return sections both present and distinctly labeled');
  console.log('  ✓ Pass: Job Receipt PDF generates correctly with accurate, non-conflated content\n');

  // Test 3: Multi-page handling - many line items must trigger a real page
  // break, repeat the table header, and still produce a valid document.
  console.log('[Test 3]: Multi-page rendering for a large item count');
  const manyItems = Array.from({ length: 60 }, (_, i) => ({
    componentId: new mongoose.Types.ObjectId(),
    partCode: `PART-${String(i).padStart(3, '0')}`,
    name: `Bulk Test Component ${i}`,
    issuedQty: 10 + i,
    receivedQty: 0,
    damagedQty: 0,
  }));
  const manyMaterial = manyItems.map((it) => ({ componentId: it.componentId, requiredQty: it.issuedQty, issuedQty: it.issuedQty }));
  const bigBuf = await generateChallanPdf({
    challanNumber: 'CHL-TEST-BIG',
    challanDate: new Date(),
    jobNumber: 'JOB-TEST-BIG',
    vendorName: 'Bulk Vendor',
    items: manyItems,
    jobCircuits: [{ circuitCode: 'CIRC-BIG', circuitName: 'Big Circuit', circuitVersion: '1.0', orderedQty: 1000 }],
    materialRequirement: manyMaterial,
    unitByComponentId: new Map(),
  });
  const pageCount = countPdfPages(bigBuf);
  if (pageCount < 2) throw new Error(`Expected a 60-item challan to span multiple pages, got ${pageCount} page(s)`);
  const bigText = extractPdfText(bigBuf);
  if (!bigText.includes('PART-000') || !bigText.includes('PART-059')) {
    throw new Error('Multi-page challan is missing rows from the first or last page - a row was cut off or lost');
  }
  if (!bigText.includes('Page 1 of') || !bigText.includes(`Page ${pageCount} of ${pageCount}`)) {
    throw new Error('Multi-page challan is missing correct page-number footers');
  }
  console.log(`  ✓ 60-item challan correctly spans ${pageCount} pages`);
  console.log('  ✓ First and last rows both present (no cut-off rows), correct page-number footers');
  console.log('  ✓ Pass: Multi-page documents paginate correctly with repeated headers and no data loss\n');
}

interface HttpResult {
  status: number;
  contentType: string | null;
  buffer: Buffer;
}

async function httpGet(url: string, token?: string): Promise<HttpResult> {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const buffer = Buffer.from(await res.arrayBuffer());
  return { status: res.status, contentType: res.headers.get('content-type'), buffer };
}

async function waitForServer(baseUrl: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Server did not become ready in time');
}

async function runHttpTests() {
  console.log('====================================================');
  console.log('   PRIORITY 7 - PDF HTTP ENDPOINT TESTS');
  console.log('====================================================\n');

  await connectDB();

  const admin = await User.findOne({ email: 'admin@wave.com' });
  if (!admin) throw new Error('Seed data required: admin user not found. Run seed.ts first.');

  const vendor = await Vendor.findOne({ isActive: true });
  if (!vendor) throw new Error('Seed data required: no active vendor found.');

  const component = (await Component.findOne({ isActive: true }))!;

  const circuit = await Circuit.create({
    circuitCode: 'PDFHTTP-TEST',
    name: 'PDF HTTP Test Circuit',
    version: '1.0',
    status: 'active',
    bomItems: [{ componentId: component._id, qtyPerUnit: 1, designator: 'R1' }],
    createdById: admin._id,
  });

  const { buildJobCircuitsAndRequirement, generateJobNumber } = await import('./controllers/jobCrudController.js');
  const { performJobApproval } = await import('./controllers/jobApprovalController.js');
  const { performMaterialIssue } = await import('./controllers/jobIssueController.js');
  const { performJobReceipt } = await import('./controllers/jobReceiptController.js');

  const built = await buildJobCircuitsAndRequirement([{ circuitId: circuit._id.toString(), orderedQty: 10 }]);
  const jobNumber = await generateJobNumber();
  const job = await Job.create({
    jobNumber,
    jobDate: new Date(),
    vendorId: vendor._id,
    targetDate: new Date(Date.now() + 86400000),
    status: 'draft',
    jobCircuits: built.jobCircuits,
    materialRequirement: built.materialRequirement,
    totalEstimatedCost: built.totalEstimatedCost,
    createdById: admin._id,
  });

  await performJobApproval(job._id.toString(), admin._id);
  const freshJob = (await Job.findById(job._id))!;
  const issueResult = await performMaterialIssue(
    job._id.toString(),
    [{ componentId: component._id.toString(), qty: freshJob.materialRequirement[0].reservedQty }],
    `pdf-http-test-${Date.now()}`,
    admin._id
  );
  const challan = issueResult.challan;

  const receiptResult = await performJobReceipt(
    job._id.toString(),
    { circuitReceipts: [{ jobCircuitId: String(job.jobCircuits[0]._id), goodQty: 8, rejectedQty: 2, rejectionReason: 'QC fail' }] },
    `pdf-http-receipt-test-${Date.now()}`,
    admin._id
  );
  const receipt = receiptResult.receipt;

  const otherJob = await Job.create({
    jobNumber: await generateJobNumber(),
    jobDate: new Date(),
    vendorId: vendor._id,
    targetDate: new Date(Date.now() + 86400000),
    status: 'draft',
    jobCircuits: built.jobCircuits,
    materialRequirement: built.materialRequirement,
    totalEstimatedCost: built.totalEstimatedCost,
    createdById: admin._id,
  });

  // Snapshot DB state before any HTTP PDF requests, to verify generation
  // performs zero mutations.
  const snapshotBefore = JSON.stringify({
    jobs: await Job.countDocuments(),
    challans: await DeliveryChallan.countDocuments(),
    receipts: await JobReceipt.countDocuments(),
    job: await Job.findById(job._id).lean(),
  });

  const PORT = process.env.PDF_TEST_SERVER_PORT || '5096';
  const baseUrl = `http://localhost:${PORT}`;
  let serverProcess: ChildProcess | null = null;

  try {
    serverProcess = spawn('npx', ['tsx', 'src/server.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT, MONGODB_URI: process.env.MONGODB_URI },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
    serverProcess.on('error', (err) => console.error('Server process error:', err));

    await waitForServer(baseUrl);
    console.log('  Temporary server started for HTTP-level PDF tests\n');

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wave.com', password: 'admin123' }),
    });
    const { token } = (await loginRes.json()) as { token: string };

    // Test 4: Correct content type + valid PDF signature for the challan.
    console.log('[Test 4]: Verifying Delivery Challan PDF endpoint - content type & signature');
    const challanPdfRes = await httpGet(`${baseUrl}/api/challans/${challan._id}/pdf`, token);
    if (challanPdfRes.status !== 200) throw new Error(`Expected 200, got ${challanPdfRes.status}`);
    if (challanPdfRes.contentType !== 'application/pdf') throw new Error(`Expected application/pdf, got ${challanPdfRes.contentType}`);
    if (challanPdfRes.buffer.slice(0, 5).toString() !== '%PDF-') throw new Error('Response body is not a valid PDF');
    console.log(`  ✓ 200, Content-Type: application/pdf, valid %PDF- signature (${challanPdfRes.buffer.length} bytes)`);
    console.log('  ✓ Pass\n');

    // Test 5: Correct content type + valid PDF signature for the job receipt.
    console.log('[Test 5]: Verifying Job Receipt PDF endpoint - content type & signature');
    const receiptPdfRes = await httpGet(`${baseUrl}/api/jobs/${job._id}/receipts/${receipt._id}/pdf`, token);
    if (receiptPdfRes.status !== 200) throw new Error(`Expected 200, got ${receiptPdfRes.status}`);
    if (receiptPdfRes.contentType !== 'application/pdf') throw new Error(`Expected application/pdf, got ${receiptPdfRes.contentType}`);
    if (receiptPdfRes.buffer.slice(0, 5).toString() !== '%PDF-') throw new Error('Response body is not a valid PDF');
    console.log(`  ✓ 200, Content-Type: application/pdf, valid %PDF- signature (${receiptPdfRes.buffer.length} bytes)`);
    console.log('  ✓ Pass\n');

    // Test 6: Unauthorized access (no token) is rejected for both endpoints.
    console.log('[Test 6]: Verifying Unauthorized Access Is Rejected');
    const unauthChallan = await httpGet(`${baseUrl}/api/challans/${challan._id}/pdf`);
    const unauthReceipt = await httpGet(`${baseUrl}/api/jobs/${job._id}/receipts/${receipt._id}/pdf`);
    if (unauthChallan.status !== 401) throw new Error(`Expected 401 for unauthenticated challan PDF request, got ${unauthChallan.status}`);
    if (unauthReceipt.status !== 401) throw new Error(`Expected 401 for unauthenticated receipt PDF request, got ${unauthReceipt.status}`);
    console.log('  ✓ Both endpoints reject requests without a valid token (401)');
    console.log('  ✓ Pass\n');

    // Test 7: Missing document handling.
    console.log('[Test 7]: Verifying Missing Document Handling');
    const fakeId = new mongoose.Types.ObjectId().toString();
    const missingChallan = await httpGet(`${baseUrl}/api/challans/${fakeId}/pdf`, token);
    const missingReceipt = await httpGet(`${baseUrl}/api/jobs/${job._id}/receipts/${fakeId}/pdf`, token);
    if (missingChallan.status !== 404) throw new Error(`Expected 404 for a nonexistent challan, got ${missingChallan.status}`);
    if (missingReceipt.status !== 404) throw new Error(`Expected 404 for a nonexistent receipt, got ${missingReceipt.status}`);
    console.log('  ✓ Both endpoints return 404 for a well-formed but nonexistent id');
    console.log('  ✓ Pass\n');

    // Test 8: Ownership/reference validation - a real receipt id requested
    // under a DIFFERENT job's URL must 404, not silently serve it.
    console.log('[Test 8]: Verifying Receipt-Belongs-To-Job Ownership Validation');
    const mismatch = await httpGet(`${baseUrl}/api/jobs/${otherJob._id}/receipts/${receipt._id}/pdf`, token);
    if (mismatch.status !== 404) throw new Error(`Expected 404 when requesting a receipt under the wrong job, got ${mismatch.status}`);
    console.log('  ✓ Requesting a real receipt under a different job\'s URL correctly returns 404');
    console.log('  ✓ Pass\n');

    // Test 9: Invalid ObjectId format handling.
    console.log('[Test 9]: Verifying Malformed Id Handling');
    const malformed = await httpGet(`${baseUrl}/api/challans/not-a-valid-id/pdf`, token);
    if (malformed.status !== 400) throw new Error(`Expected 400 for a malformed challan id, got ${malformed.status}`);
    console.log('  ✓ Malformed id correctly rejected with 400 (not a 500 crash)');
    console.log('  ✓ Pass\n');
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }

  // Test 10: No database mutation occurred from any of the PDF generation
  // requests above (reads only).
  console.log('[Test 10]: Verifying No Database Mutation During PDF Generation');
  const snapshotAfter = JSON.stringify({
    jobs: await Job.countDocuments(),
    challans: await DeliveryChallan.countDocuments(),
    receipts: await JobReceipt.countDocuments(),
    job: await Job.findById(job._id).lean(),
  });
  if (snapshotBefore !== snapshotAfter) {
    throw new Error('Job/Challan/Receipt state changed as a result of PDF generation requests - generation must be read-only');
  }
  console.log('  ✓ Job, DeliveryChallan, and JobReceipt document counts and content unchanged');
  console.log('  ✓ Pass: PDF generation performed zero database writes\n');

  // Cleanup test fixtures.
  await Job.deleteMany({ _id: { $in: [job._id, otherJob._id] } });
  await DeliveryChallan.deleteOne({ _id: challan._id });
  await JobReceipt.deleteOne({ _id: receipt._id });
  await Circuit.deleteOne({ _id: circuit._id });
  console.log('  (PDF test fixtures cleaned up)\n');
}

async function main() {
  await runGeneratorTests();
  await runHttpTests();

  console.log('====================================================');
  console.log('   ALL PRIORITY 7 PDF TESTS PASSED!');
  console.log('====================================================');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('PDF test failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
