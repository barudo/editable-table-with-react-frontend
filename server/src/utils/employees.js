const requiredFields = ['employeeId', 'name', 'city', 'country', 'age'];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeNumber(value) {
  if (isBlank(value)) return value;
  return Number(value);
}

export function buildSearchFilter(search) {
  const query = String(search || '').trim();

  if (!query) return {};

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const numericQuery = Number(query);
  const numericFilters = Number.isFinite(numericQuery)
    ? [{ employeeId: numericQuery }, { age: numericQuery }]
    : [];

  return {
    $or: [
      { name: regex },
      { city: regex },
      { country: regex },
      ...numericFilters,
    ],
  };
}

export function validateEmployeeRows(inputRows, options = {}) {
  const errors = [];
  const partial = Boolean(options.partial);
  const rows = inputRows.map((inputRow, index) => {
    const row = {};

    for (const field of requiredFields) {
      if (!partial || Object.prototype.hasOwnProperty.call(inputRow, field)) {
        row[field] = inputRow[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(inputRow, 'employee id')) {
      row.employeeId = inputRow['employee id'];
    }

    if (Object.prototype.hasOwnProperty.call(row, 'employeeId')) {
      row.employeeId = normalizeNumber(row.employeeId);
    }

    if (Object.prototype.hasOwnProperty.call(row, 'age')) {
      row.age = normalizeNumber(row.age);
    }

    const rowLabel = `Row ${index + 1}`;

    for (const field of requiredFields) {
      if (!partial && isBlank(row[field])) {
        errors.push(`${rowLabel}: ${field} is required.`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(row, 'employeeId') && !Number.isFinite(row.employeeId)) {
      errors.push(`${rowLabel}: employeeId must be a number.`);
    }

    if (Object.prototype.hasOwnProperty.call(row, 'age') && !Number.isFinite(row.age)) {
      errors.push(`${rowLabel}: age must be a number.`);
    }

    return row;
  });

  return { errors, rows };
}

export function normalizeEmployee(employee) {
  return {
    id: String(employee._id),
    employeeId: employee.employeeId,
    name: employee.name,
    city: employee.city,
    country: employee.country,
    age: employee.age,
  };
}
