import express from 'express';
import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import {
  buildSearchFilter,
  normalizeEmployee,
  validateEmployeeRows,
} from '../utils/employees.js';

const router = express.Router();

router.get('/', async (request, response, next) => {
  try {
    const filter = buildSearchFilter(request.query.search);
    const employees = await Employee.find(filter).sort({ createdAt: -1 }).lean();

    response.json(employees.map(normalizeEmployee));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (request, response, next) => {
  try {
    const inputRows = Array.isArray(request.body.rows) ? request.body.rows : [request.body];
    const { errors, rows } = validateEmployeeRows(inputRows);

    if (errors.length > 0) {
      return response.status(400).json({ message: 'Invalid employee data.', details: errors });
    }

    const employees = await Employee.insertMany(rows);
    response.status(201).json(employees);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Invalid employee id.' });
    }

    const { errors, rows } = validateEmployeeRows([{ ...request.body }]);

    if (errors.length > 0) {
      return response.status(400).json({ message: 'Invalid employee data.', details: errors });
    }

    const employee = await Employee.findByIdAndUpdate(
      request.params.id,
      { $set: rows[0] },
      { new: true, runValidators: true },
    ).lean();

    if (!employee) {
      return response.status(404).json({ message: 'Employee not found.' });
    }

    response.json(normalizeEmployee(employee));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Invalid employee id.' });
    }

    const { errors, rows } = validateEmployeeRows([{ ...request.body }], { partial: true });

    if (errors.length > 0) {
      return response.status(400).json({ message: 'Invalid employee data.', details: errors });
    }

    const employee = await Employee.findByIdAndUpdate(
      request.params.id,
      { $set: rows[0] },
      { new: true, runValidators: true },
    );

    if (!employee) {
      return response.status(404).json({ message: 'Employee not found.' });
    }

    response.json(employee);
  } catch (error) {
    next(error);
  }
});

router.delete('/', async (request, response, next) => {
  try {
    const { ids = [], all = false, search = '' } = request.body;

    if (all) {
      const result = await Employee.deleteMany(buildSearchFilter(search));
      return response.json({ deletedCount: result.deletedCount });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return response.status(400).json({ message: 'Provide selected employee ids or set all=true.' });
    }

    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));

    if (validIds.length !== ids.length) {
      return response.status(400).json({ message: 'One or more employee ids are invalid.' });
    }

    const result = await Employee.deleteMany({ _id: { $in: validIds } });
    response.json({ deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

router.post('/import', async (request, response, next) => {
  try {
    const mode = request.body.mode === 'replace' ? 'replace' : 'append';
    const inputRows = Array.isArray(request.body.rows) ? request.body.rows : [];
    const { errors, rows } = validateEmployeeRows(inputRows);

    if (errors.length > 0) {
      return response.status(400).json({ message: 'Invalid import data.', details: errors });
    }

    if (mode === 'replace') {
      await Employee.deleteMany({});
    }

    const importedRows = await Employee.insertMany(rows);

    response.status(201).json({ mode, importedCount: importedRows.length, rows: importedRows });
  } catch (error) {
    next(error);
  }
});

router.post('/export', async (request, response, next) => {
  try {
    const { ids = [], search = '' } = request.body;
    const filter = Array.isArray(ids) && ids.length > 0
      ? { _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) } }
      : buildSearchFilter(search);
    const rows = await Employee.find(filter).sort({ createdAt: -1 }).lean();

    response.json(rows.map(normalizeEmployee));
  } catch (error) {
    next(error);
  }
});

export default router;
