import { Response } from 'express';
import { DeliveryChallan } from '../models/DeliveryChallan.js';
import { AuthRequest } from '../middleware/auth.js';

// Lists challans for a specific job (a job can have multiple challans from
// partial issues). Matches the original spec: "no separate challan menu" -
// challans are reached via the job, so this is the primary listing entry
// point rather than a top-level unfiltered list.
export const getChallansByJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const challans = await DeliveryChallan.find({ jobId: req.params.jobId })
      .populate('issuedById', 'name email')
      .sort({ createdAt: -1 });
    res.json({ data: challans });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching delivery challans' });
  }
};

// Single challan by id, for the printable view.
export const getChallanById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const challan = await DeliveryChallan.findById(req.params.id)
      .populate('issuedById', 'name email')
      .populate('vendorId', 'name contactPerson phone city');

    if (!challan) {
      res.status(404).json({ message: 'Delivery challan not found' });
      return;
    }

    res.json({ data: challan });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching delivery challan' });
  }
};
