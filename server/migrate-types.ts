/**
 * Migration Script: Convert Subscription and Compliance/History Fields to Native Types
 * 
 * This script runs through all subscriptions, compliance, and history records in MongoDB and updates:
 * - Dates (startDate, nextRenewal, filingStartDate, filingEndDate, etc.) ➔ native ISODate
 * - Numbers (amount, submissionAmount, reminderDays) ➔ native number / null if empty string
 * - ObjectIds (submittedBy, complianceId) ➔ native ObjectId / null if empty string
 * - Departments ➔ native array of strings
 * - department ➔ removed/unset legacy field
 * 
 * Usage: npm run migrate-types
 */

import { connectToDatabase } from './mongo.js';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

function parseDepartments(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(d => String(d).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(d => String(d).trim()).filter(Boolean);
        }
      } catch (e) {
        // Fallback if JSON parse fails
      }
    }
    return trimmed.split(/[|,,]/).map(d => d.trim()).filter(Boolean);
  }
  return [];
}

async function migrateCollection(db: any, collectionName: string, type: 'subscription' | 'compliance_or_history') {
  console.log(`\n📦 Processing collection: ${collectionName}...`);
  const collection = db.collection(collectionName);
  const documents = await collection.find({}).toArray();
  console.log(`📊 Found ${documents.length} records in ${collectionName}`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of documents) {
    try {
      const setDoc: any = {};
      const unsetDoc: any = {};
      let needsUpdate = false;

      // 1. Process Date fields
      const dateFields = type === 'subscription' 
        ? ['startDate', 'nextRenewal', 'initialDate', 'firstPurchaseDate', 'currentCycleStart', 'createdAt', 'updatedAt']
        : ['filingStartDate', 'filingEndDate', 'filingSubmissionDeadline', 'filingSubmissionDate', 'endDate', 'submissionDeadline', 'lastAudit', 'paymentDate', 'startDate', 'expectedCompletedDate', 'renewalInitiatedDate', 'createdAt', 'updatedAt'];

      for (const field of dateFields) {
        if (field in doc) {
          const val = doc[field];
          if (val === undefined || val === null || val === '') {
            if (val !== null) {
              setDoc[field] = null;
              needsUpdate = true;
            }
          } else if (typeof val === 'string' || val instanceof String) {
            const d = new Date(val as any);
            if (!isNaN(d.getTime())) {
              setDoc[field] = d;
              needsUpdate = true;
            }
          }
        }
      }

      // 2. Process Number fields
      const numFields = type === 'subscription'
        ? ['amount', 'reminderDays']
        : ['submissionAmount', 'amount', 'reminderDays'];

      for (const field of numFields) {
        if (field in doc) {
          const val = doc[field];
          if (val === undefined || val === null || val === '') {
            if (val !== null) {
              setDoc[field] = null;
              needsUpdate = true;
            }
          } else if (typeof val === 'string' || val instanceof String || typeof val !== 'number') {
            const num = Number(val);
            if (!isNaN(num)) {
              if (doc[field] !== num) {
                setDoc[field] = num;
                needsUpdate = true;
              }
            } else {
              setDoc[field] = null;
              needsUpdate = true;
            }
          }
        }
      }

      // 3. Process ObjectId fields
      if (type === 'compliance_or_history') {
        const oidFields = ['submittedBy', 'complianceId'];
        for (const field of oidFields) {
          if (field in doc) {
            const val = doc[field];
            if (val === undefined || val === null || val === '') {
              if (val !== null) {
                setDoc[field] = null;
                needsUpdate = true;
              }
            } else if (typeof val === 'string' && val.length === 24 && /^[0-9a-fA-F]{24}$/.test(val)) {
              setDoc[field] = new ObjectId(val);
              needsUpdate = true;
            }
          }
        }
      }

      // 4. Process departments/department array
      let departmentsList: string[] = [];
      let departmentsChanged = false;
      
      if (doc.departments !== undefined && doc.departments !== null) {
        if (typeof doc.departments === 'string') {
          departmentsList = parseDepartments(doc.departments);
          departmentsChanged = true;
        } else if (Array.isArray(doc.departments)) {
          departmentsList = parseDepartments(doc.departments);
          if (JSON.stringify(doc.departments) !== JSON.stringify(departmentsList)) {
            departmentsChanged = true;
          }
        }
      } else if (doc.department) {
        departmentsList = parseDepartments(doc.department);
        departmentsChanged = true;
      }

      if (departmentsChanged) {
        setDoc.departments = departmentsList;
        needsUpdate = true;
      }

      // 5. Remove legacy department field
      if ('department' in doc) {
        unsetDoc.department = '';
        needsUpdate = true;
      }

      if (needsUpdate) {
        const updateOp: any = {};
        if (Object.keys(setDoc).length > 0) {
          updateOp.$set = setDoc;
        }
        if (Object.keys(unsetDoc).length > 0) {
          updateOp.$unset = unsetDoc;
        }
        await collection.updateOne({ _id: doc._id }, updateOp);
        migrated++;
      } else {
        skipped++;
      }
    } catch (e) {
      console.error(`❌ Error migrating doc ${doc._id} in ${collectionName}:`, e);
      errors++;
    }
  }

  console.log(`✅ ${collectionName} Summary: Migrated=${migrated}, Skipped=${skipped}, Errors=${errors}`);
}

async function migrateTypes() {
  console.log('\n🔄 Starting database data type migration (Strings ➔ Native Dates/Arrays/Numbers/ObjectIds)...\n');
  try {
    const db = await connectToDatabase();
    await migrateCollection(db, 'subscriptions', 'subscription');
    await migrateCollection(db, 'compliance', 'compliance_or_history');
    await migrateCollection(db, 'history', 'compliance_or_history');
    await migrateCollection(db, 'ledger', 'compliance_or_history');
    await migrateCollection(db, 'licenses', 'compliance_or_history');
    await migrateCollection(db, 'companyInfo', 'compliance_or_history');
    await migrateCollection(db, 'currencies', 'compliance_or_history');
    await migrateCollection(db, 'employees', 'compliance_or_history');
    await migrateCollection(db, 'payment', 'compliance_or_history');
    console.log('\n🎉 All collections type conversion completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateTypes();
