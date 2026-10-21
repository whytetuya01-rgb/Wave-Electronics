import { Response } from 'express';
import mongoose from 'mongoose';
import { DeliveryChallan } from '../models/DeliveryChallan.js';
import { Job } from '../models/Job.js';
import { JobReceipt } from '../models/JobReceipt.js';
import { Vendor } from '../models/Vendor.js';
import { Component } from '../models/Component.js';
import { Unit } from '../models/Unit.js';
import { AuthRequest } from '../middleware/auth.js';
import { generateChallanPdf } from '../services/pdf/challanPdf.js';
import { generateJobReceiptPdf } from '../services/pdf/jobReceiptPdf.js';
import { getSettings } from '../models/Settings.js';
import { CompanyInfo } from '../services/pdf/pdfLayout.js';

async function resolveCompanyInfo(): Promise<CompanyInfo> {
  const settings = await getSettings();
  return {
    companyName: settings.companyName,
    address: settings.address,
    gstin: settings.gstin,
    logoPath: settings.logoPath,
  };
}

// Read-only: fetches a Delivery Challan and its owning Job, generates the
// printable PDF, and streams it as a download. Never writes to the
// database. Authorization matches the existing challan-detail endpoint
// (GET /challans/:id) - any authenticated user, no extra role restriction.
export const getChallanPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: 'Invalid delivery challan id' });
      return;
    }

    const challan = await DeliveryChallan.findById(id);
    if (!challan) {
      res.status(404).json({ message: 'Delivery challan not found' });
      return;
    }

    const job = await Job.findById(challan.jobId).select('jobNumber jobCircuits materialRequirement');
    if (!job) {
      res.status(404).json({ message: 'Job for this delivery challan no longer exists' });
      return;
    }

    const componentIds = challan.items.map((i) => i.componentId);
    const components = await Component.find({ _id: { $in: componentIds } }).select('unitId');
    const unitIds = components.map((c) => c.unitId).filter(Boolean);
    const units = await Unit.find({ _id: { $in: unitIds } }).select('shortCode');
    const unitById = new Map(units.map((u) => [u._id.toString(), u.shortCode]));
    const unitByComponentId = new Map(
      components.map((c) => [c._id.toString(), c.unitId ? unitById.get(c.unitId.toString()) || '-' : '-'])
    );

    const companyInfo = await resolveCompanyInfo();
    const pdfBuffer = await generateChallanPdf({
      challanNumber: challan.challanNumber,
      challanDate: challan.challanDate,
      jobNumber: challan.jobNumber,
      vendorName: challan.vendorName,
      vendorAddress: challan.vendorAddress,
      vendorCity: challan.vendorCity,
      vendorGstNumber: challan.vendorGstNumber,
      items: challan.items,
      jobCircuits: job.jobCircuits,
      materialRequirement: job.materialRequirement,
      unitByComponentId,
      companyInfo,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${challan.challanNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating delivery challan PDF' });
  }
};

// Read-only: fetches a Job Receipt, verifies it actually belongs to the
// given job (the :id and :receiptId in the URL must agree - otherwise 404
// rather than silently serving a receipt from a different job), generates
// the printable PDF, and streams it as a download. Never writes to the
// database. Authorization matches the existing receipt-listing endpoint
// (GET /jobs/:id/receipts) - any authenticated user.
export const getJobReceiptPdf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, receiptId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(receiptId)) {
      res.status(400).json({ message: 'Invalid job or receipt id' });
      return;
    }

    const receipt = await JobReceipt.findById(receiptId);
    if (!receipt || receipt.jobId.toString() !== id) {
      res.status(404).json({ message: 'Job receipt not found for this job' });
      return;
    }

    const vendor = await Vendor.findById(receipt.vendorId).select('name address city gstNumber');

    const companyInfo = await resolveCompanyInfo();
    const pdfBuffer = await generateJobReceiptPdf({
      receiptNumber: receipt.receiptNumber,
      receiptDate: receipt.receiptDate,
      jobNumber: receipt.jobNumber,
      vendorRefNumber: receipt.vendorRefNumber,
      vendorName: vendor?.name,
      vendorAddress: vendor?.address,
      vendorCity: vendor?.city,
      vendorGstNumber: vendor?.gstNumber,
      circuitReceipts: receipt.circuitReceipts,
      componentReturns: receipt.componentReturns,
      remarks: receipt.remarks,
      companyInfo,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error generating job receipt PDF' });
  }
};
