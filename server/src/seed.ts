import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models/User.js';
import { Category } from './models/Category.js';
import { Unit } from './models/Unit.js';
import { Location } from './models/Location.js';
import { Component } from './models/Component.js';
import { StockTransaction } from './models/StockTransaction.js';
import { Vendor } from './models/Vendor.js';
import { StockInward } from './models/StockInward.js';
import { Counter } from './models/Counter.js';
import { Circuit } from './models/Circuit.js';
import { Job } from './models/Job.js';
import { DeliveryChallan } from './models/DeliveryChallan.js';
import { MaterialReceipt } from './models/MaterialReceipt.js';
import { JobReceipt } from './models/JobReceipt.js';
import { FinishedGoods } from './models/FinishedGoods.js';
import { FinishedGoodsTransaction } from './models/FinishedGoodsTransaction.js';
import { assertDisposableDatabase } from './config/databaseSafety.js';
import { passwordPolicyError } from './utils/passwordPolicy.js';

// Fills a DISPOSABLE database (preview, dev or test) with demo masters,
// components, vendors and one stock inward. It first DELETES every collection
// listed below, so it refuses any database that isn't disposable (see
// config/databaseSafety.ts) and can never run against production.
//
// The only login it creates is one admin, taken from the environment:
//   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (12+ characters), SEED_ADMIN_NAME (optional)
async function seed() {
  try {
    const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const adminName = process.env.SEED_ADMIN_NAME?.trim() || 'System Admin';
    if (!adminEmail) {
      throw new Error('Set SEED_ADMIN_EMAIL to the email address for the admin login.');
    }
    const passwordError = passwordPolicyError(adminPassword, adminEmail);
    if (passwordError) {
      throw new Error(`SEED_ADMIN_PASSWORD: ${passwordError}.`);
    }

    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wave_electronics_dev';
    assertDisposableDatabase('The seed script', mongoUri);
    await mongoose.connect(mongoUri);
    // Name and host only: the URI itself contains the database password.
    console.log(`Connected to database "${mongoose.connection.name}" on ${mongoose.connection.host}`);

    console.log('Clearing existing collections for fresh setup...');
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Unit.deleteMany({}),
      Location.deleteMany({}),
      Component.deleteMany({}),
      StockTransaction.deleteMany({}),
      Vendor.deleteMany({}),
      StockInward.deleteMany({}),
      Counter.deleteMany({}),
      Circuit.deleteMany({}),
      Job.deleteMany({}),
      DeliveryChallan.deleteMany({}),
      MaterialReceipt.deleteMany({}),
      JobReceipt.deleteMany({}),
      FinishedGoods.deleteMany({}),
      FinishedGoodsTransaction.deleteMany({}),
    ]);

    console.log('1. Seeding the admin user...');
    const adminUser = await User.create({
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword as string, await bcrypt.genSalt(10)),
      role: 'admin',
      isActive: true,
    });
    console.log(`✓ Admin user created: ${adminEmail}`);

    console.log('2. Seeding Categories...');
    const categories = await Category.create([
      { name: 'Microcontrollers & ICs', description: 'MCUs, DSPs, voltage regulators and operational amplifiers' },
      { name: 'Resistors', description: 'SMD and through-hole resistors' },
      { name: 'Capacitors', description: 'Ceramic, electrolytic and tantalum capacitors' },
      { name: 'Diodes & Transistors', description: 'Schottky, zener, MOSFETs and BJTs' },
      { name: 'Connectors & Terminals', description: 'Headers, terminal blocks, USB and JST connectors' },
      { name: 'Passive Electromechanical', description: 'Relays, switches, crystals and oscillators' },
    ]);
    console.log(`✓ ${categories.length} Categories created`);

    console.log('3. Seeding Units...');
    const units = await Unit.create([
      { name: 'Numbers', shortCode: 'NOS' },
      { name: 'Reels', shortCode: 'REEL' },
      { name: 'Meters', shortCode: 'MTR' },
      { name: 'Packs', shortCode: 'PACK' },
    ]);
    console.log(`✓ ${units.length} Units created`);

    console.log('4. Seeding Storage Locations...');
    const locations = await Location.create([
      { name: 'Rack A - Bin 01', zone: 'Zone A (SMD)', description: 'SMD Reels 0805/0603' },
      { name: 'Rack A - Bin 02', zone: 'Zone A (SMD)', description: 'SMD ICs and SOIC' },
      { name: 'Rack B - Bin 10', zone: 'Zone B (Power)', description: 'Through-hole & Power components' },
      { name: 'Rack C - Bin 05', zone: 'Zone C (Connectors)', description: 'Terminal blocks and headers' },
    ]);
    console.log(`✓ ${locations.length} Locations created`);

    console.log('5. Seeding Components and Initial Ledger Entries...');
    const nosUnit = units.find((u) => u.shortCode === 'NOS')!;
    const icCat = categories.find((c) => c.name === 'Microcontrollers & ICs')!;
    const resCat = categories.find((c) => c.name === 'Resistors')!;
    const capCat = categories.find((c) => c.name === 'Capacitors')!;
    const connCat = categories.find((c) => c.name === 'Connectors & Terminals')!;

    const initialComponentsData = [
      {
        partCode: 'IC-STM32F103C8T6',
        name: 'STM32 ARM Cortex-M3 MCU LQFP-48',
        categoryId: icCat._id,
        unitId: nosUnit._id,
        locationId: locations[1]._id,
        package: 'LQFP-48',
        specifications: { frequency: '72MHz', flash: '64KB', ram: '20KB', voltage: '3.3V' },
        openingStock: 250,
        minStock: 50,
        ratePerUnit: 145.0,
      },
      {
        partCode: 'RES-10K-0805-1%',
        name: 'Resistor SMD 10K Ohm 1% 1/8W',
        categoryId: resCat._id,
        unitId: nosUnit._id,
        locationId: locations[0]._id,
        package: '0805',
        specifications: { resistance: '10k Ohm', tolerance: '1%', power: '0.125W' },
        openingStock: 5000,
        minStock: 1000,
        ratePerUnit: 0.45,
      },
      {
        partCode: 'CAP-100NF-0805-50V',
        name: 'Capacitor Ceramic SMD 100nF 50V X7R',
        categoryId: capCat._id,
        unitId: nosUnit._id,
        locationId: locations[0]._id,
        package: '0805',
        specifications: { capacitance: '100nF', voltage: '50V', dielectric: 'X7R' },
        openingStock: 4000,
        minStock: 800,
        ratePerUnit: 0.65,
      },
      {
        partCode: 'IC-AMS1117-3.3',
        name: 'Voltage Regulator LDO 3.3V 1A SOT-223',
        categoryId: icCat._id,
        unitId: nosUnit._id,
        locationId: locations[1]._id,
        package: 'SOT-223',
        specifications: { outputVoltage: '3.3V', current: '1A', type: 'LDO' },
        openingStock: 30, // Intentionally low stock to demonstrate low-stock alert!
        minStock: 100,
        ratePerUnit: 8.5,
      },
      {
        partCode: 'CONN-TB-2P-5.08',
        name: 'Screw Terminal Block 2-Pin 5.08mm Pitch',
        categoryId: connCat._id,
        unitId: nosUnit._id,
        locationId: locations[3]._id,
        package: 'Through-Hole',
        specifications: { pitch: '5.08mm', poles: '2', currentRating: '16A' },
        openingStock: 450,
        minStock: 100,
        ratePerUnit: 12.0,
      },
    ];

    for (const item of initialComponentsData) {
      const component = await Component.create({
        partCode: item.partCode,
        name: item.name,
        categoryId: item.categoryId,
        unitId: item.unitId,
        locationId: item.locationId,
        package: item.package,
        specifications: item.specifications,
        inStoreStock: item.openingStock,
        reservedStock: 0,
        withVendorStock: 0,
        minStock: item.minStock,
        ratePerUnit: item.ratePerUnit,
        isActive: true,
      });

      // Post opening stock transaction to the immutable ledger
      if (item.openingStock > 0) {
        await StockTransaction.create({
          componentId: component._id,
          type: 'OPENING',
          locationType: 'STORE',
          qtyChange: item.openingStock,
          balanceInStoreAfter: item.openingStock,
          balanceReservedAfter: 0,
          balanceWithVendorAfter: 0,
          referenceType: 'OPENING',
          referenceId: component._id,
          notes: `Initial opening stock migration for ${component.partCode}`,
          createdById: adminUser._id,
        });
      }
    }

    console.log(`✓ ${initialComponentsData.length} Components created and ledger balances established.`);

    console.log('6. Seeding Vendors (Job Work Assemblers)...');
    const vendors = await Vendor.create([
      {
        name: 'Apex EMS Solutions',
        contactPerson: 'Sunil Sharma',
        phone: '+91 98220 12345',
        email: 'sunil@apexems.in',
        gstNumber: '27AABCA1234F1Z5',
        address: 'Plot 42, Bhosari MIDC Industrial Area',
        city: 'Pune',
        state: 'Maharashtra',
        circuitsCanAssemble: ['PWM Motor Controller v1.0', '5V Dual USB Power Supply'],
        defaultJobWorkRate: 35.0,
        remarks: 'Specialized in high-speed SMT placement and wave soldering',
        isActive: true,
      },
      {
        name: 'SMT Micro Circuits',
        contactPerson: 'Rajesh Verma',
        phone: '+91 98450 67890',
        email: 'rajesh@smtmicro.co.in',
        gstNumber: '29AABCS5678K1Z2',
        address: 'Phase 2, Electronic City',
        city: 'Bengaluru',
        state: 'Karnataka',
        circuitsCanAssemble: ['IoT Sensor Node v2.1', 'Smart LED Driver'],
        defaultJobWorkRate: 28.5,
        remarks: 'Equipped with 0402 placement capability and AOI inspection',
        isActive: true,
      },
      {
        name: 'Delta Tech Assembly Works',
        contactPerson: 'Deepali Patel',
        phone: '+91 97120 44556',
        email: 'contact@deltatech.biz',
        gstNumber: '24AABCD9012J1Z8',
        address: 'GIDC Industrial Estate, Makarpura',
        city: 'Vadodara',
        state: 'Gujarat',
        circuitsCanAssemble: ['Industrial Relay Board', 'High Power Switcher'],
        defaultJobWorkRate: 42.0,
        remarks: 'Heavy duty through-hole and conformal coating expertise',
        isActive: true,
      },
    ]);
    console.log(`✓ ${vendors.length} Vendors created`);

    console.log('7. Seeding Initial Stock Inward...');
    const amsComponent = await Component.findOne({ partCode: 'IC-AMS1117-3.3' });
    const resComponent = await Component.findOne({ partCode: 'RES-10K-0805-1%' });

    if (amsComponent && resComponent) {
      const inwardNumber = 'INW-202610-0001';
      const inwardDate = new Date();
      const supplierName = 'Mouser Electronics India';
      const billNumber = 'ME-INV-2026-9041';

      const items = [
        {
          componentId: amsComponent._id,
          partCode: amsComponent.partCode,
          name: amsComponent.name,
          unitShortCode: 'NOS',
          qty: 500,
          unitRate: 7.8,
          totalAmount: 3900.0,
          remarks: 'Restock lot for production batch',
        },
        {
          componentId: resComponent._id,
          partCode: resComponent.partCode,
          name: resComponent.name,
          unitShortCode: 'NOS',
          qty: 2000,
          unitRate: 0.42,
          totalAmount: 840.0,
          remarks: 'SMD Reels 0805 tape',
        },
      ];

      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);

      const stockInward = await StockInward.create({
        inwardNumber,
        inwardDate,
        supplierName,
        billNumber,
        billDate: new Date(Date.now() - 86400000 * 2),
        items,
        totalItems: items.length,
        totalQty,
        totalAmount,
        notes: 'Monthly active components procurement',
        createdById: adminUser._id,
      });

      // Update components stock and post ledger
      for (const item of items) {
        const comp = await Component.findById(item.componentId);
        if (comp) {
          comp.inStoreStock += item.qty;
          comp.ratePerUnit = item.unitRate;
          await comp.save();

          await StockTransaction.create({
            componentId: comp._id,
            type: 'INWARD',
            locationType: 'STORE',
            qtyChange: item.qty,
            balanceInStoreAfter: comp.inStoreStock,
            balanceReservedAfter: comp.reservedStock,
            balanceWithVendorAfter: comp.withVendorStock,
            referenceType: 'INWARD',
            referenceId: stockInward._id,
            referenceNo: inwardNumber,
            notes: `Inward from ${supplierName} (Bill: ${billNumber})`,
            createdById: adminUser._id,
          });
        }
      }
      console.log(`✓ 1 Stock Inward entry created (${totalQty} units, ₹${totalAmount}) with updated stock and ledger.`);
    }

    console.log('\n--- SEED COMPLETE ---');
    console.log(`Sign in as ${adminEmail} with the password from SEED_ADMIN_PASSWORD.`);
    console.log('Add store keeper and production users on the Users page.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

seed();
