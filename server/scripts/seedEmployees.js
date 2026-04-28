import dotenv from 'dotenv';
import mongoose from 'mongoose';
import XLSX from 'xlsx';
import { connectDatabase } from '../src/config/database.js';
import { Employee } from '../src/models/Employee.js';
import { validateEmployeeRows } from '../src/utils/employees.js';

dotenv.config({ path: 'server/.env' });

const workbookPath = process.argv[2] || 'attachments/Book1.xlsx';
const expectedHeaders = ['employee id', 'name', 'city', 'country', 'age'];

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase();
}

function findHeaderRow(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex].map(normalizeHeader);
    const startIndex = row.findIndex((value) => value === expectedHeaders[0]);

    if (startIndex === -1) continue;

    const hasExpectedHeaders = expectedHeaders.every(
      (header, offset) => row[startIndex + offset] === header,
    );

    if (hasExpectedHeaders) {
      return { rowIndex, startIndex, matrix };
    }
  }

  return null;
}

function readEmployeesFromWorkbook(path) {
  const workbook = XLSX.readFile(path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const headerLocation = findHeaderRow(sheet);

  if (!headerLocation) {
    throw new Error('Could not find expected headers in workbook.');
  }

  return headerLocation.matrix
    .slice(headerLocation.rowIndex + 1)
    .map((row) => {
      const values = row.slice(headerLocation.startIndex, headerLocation.startIndex + expectedHeaders.length);
      return {
        employeeId: values[0],
        name: values[1],
        city: values[2],
        country: values[3],
        age: values[4],
      };
    })
    .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''));
}

async function seedEmployees() {
  const workbookRows = readEmployeesFromWorkbook(workbookPath);
  const { errors, rows } = validateEmployeeRows(workbookRows);

  if (errors.length > 0) {
    throw new Error(`Invalid workbook data:\n${errors.join('\n')}`);
  }

  await connectDatabase();
  await Employee.deleteMany({});
  const insertedRows = await Employee.insertMany(rows);

  console.log(`Seeded ${insertedRows.length} employee rows from ${workbookPath}.`);
}

seedEmployees()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
