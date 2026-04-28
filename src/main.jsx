import React from 'react';
import ReactDOM from 'react-dom/client';
import { Download, FilePlus2, FileUp, Plus, Search, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import './styles.css';

const columns = [
  { key: 'employeeId', label: 'employee id', type: 'number' },
  { key: 'name', label: 'name', type: 'text' },
  { key: 'city', label: 'city', type: 'text' },
  { key: 'country', label: 'country', type: 'text' },
  { key: 'age', label: 'age', type: 'number' },
];

function createDraftRow() {
  return {
    id: crypto.randomUUID(),
    employeeId: '',
    name: '',
    city: '',
    country: '',
    age: '',
    status: 'draft',
  };
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase();
}

function validateImportedRows(rows) {
  const errors = [];
  const validRows = rows.map((row, index) => {
    const normalized = {
      id: crypto.randomUUID(),
      employeeId: Number(row['employee id']),
      name: String(row.name ?? '').trim(),
      city: String(row.city ?? '').trim(),
      country: String(row.country ?? '').trim(),
      age: Number(row.age),
    };

    if (!Number.isFinite(normalized.employeeId)) errors.push(`Row ${index + 1}: employee id must be a number.`);
    if (!normalized.name) errors.push(`Row ${index + 1}: name is required.`);
    if (!normalized.city) errors.push(`Row ${index + 1}: city is required.`);
    if (!normalized.country) errors.push(`Row ${index + 1}: country is required.`);
    if (!Number.isFinite(normalized.age)) errors.push(`Row ${index + 1}: age must be a number.`);

    return normalized;
  });

  return { errors, validRows };
}

function findHeaderRow(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  const expected = columns.map((column) => column.label);

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex].map(normalizeHeader);
    const startIndex = row.findIndex((value) => value === expected[0]);

    if (startIndex === -1) continue;

    const hasExpectedHeaders = expected.every((header, offset) => row[startIndex + offset] === header);
    if (hasExpectedHeaders) {
      return { rowIndex, startIndex };
    }
  }

  return null;
}

function parseWorkbook(file) {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const headerLocation = findHeaderRow(sheet);

    if (!headerLocation) {
      throw new Error('Uploaded file must contain columns: employee id, name, city, country, age.');
    }

    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
    const dataRows = matrix.slice(headerLocation.rowIndex + 1);

    return dataRows
      .map((row) => {
        const values = row.slice(headerLocation.startIndex, headerLocation.startIndex + columns.length);
        return Object.fromEntries(columns.map((column, index) => [column.label, values[index]]));
      })
      .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''));
  });
}

function exportRows(rows, fileName) {
  const worksheetRows = rows.map((row) => ({
    'employee id': row.employeeId,
    name: row.name,
    city: row.city,
    country: row.country,
    age: row.age,
  }));
  const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
  XLSX.writeFile(workbook, fileName);
}

function normalizeApiEmployee(employee) {
  return {
    id: employee.id || employee._id,
    employeeId: employee.employeeId,
    name: employee.name,
    city: employee.city,
    country: employee.country,
    age: employee.age,
  };
}

async function readApiError(response, fallbackMessage) {
  try {
    const errorBody = await response.json();
    return errorBody.details?.join(' ') || errorBody.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function validateRow(row) {
  const errors = [];
  const employeeId = Number(row.employeeId);
  const age = Number(row.age);

  if (!String(row.employeeId).trim() || !Number.isFinite(employeeId)) {
    errors.push('employee id must be a number');
  }

  if (!String(row.name).trim()) errors.push('name is required');
  if (!String(row.city).trim()) errors.push('city is required');
  if (!String(row.country).trim()) errors.push('country is required');

  if (!String(row.age).trim() || !Number.isFinite(age)) {
    errors.push('age must be a number');
  }

  return {
    errors,
    isValid: errors.length === 0,
    payload: {
      employeeId,
      name: String(row.name).trim(),
      city: String(row.city).trim(),
      country: String(row.country).trim(),
      age,
    },
  };
}

function isDraftRow(row) {
  return row.status === 'draft' || row.status === 'error';
}

function isDirtySavedRow(row) {
  return row.status === 'dirty' || row.status === 'update-error';
}

function App() {
  const [rows, setRows] = React.useState([]);
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [filter, setFilter] = React.useState('');
  const [isLoadingRows, setIsLoadingRows] = React.useState(true);
  const [rowCount, setRowCount] = React.useState(1);
  const [message, setMessage] = React.useState('');
  const fileInputRef = React.useRef(null);
  const importModeRef = React.useRef('append');
  const rowsRef = React.useRef(rows);
  const selectedIdsRef = React.useRef(selectedIds);

  React.useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  React.useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  React.useEffect(() => {
    const controller = new AbortController();

    async function fetchRows() {
      try {
        setIsLoadingRows(true);
        const response = await fetch('/api/employees', { signal: controller.signal });

        if (!response.ok) {
          throw new Error('Unable to load employees from the backend.');
        }

        const employees = await response.json();
        setRows(employees);
        setSelectedIds([]);
        setMessage(`Loaded ${employees.length} rows from MongoDB.`);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setMessage(error.message);
        }
      } finally {
        setIsLoadingRows(false);
      }
    }

    fetchRows();

    return () => controller.abort();
  }, []);

  const filteredRows = React.useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      columns.some((column) => String(row[column.key]).toLowerCase().includes(query)),
    );
  }, [filter, rows]);

  const selectedFilteredRows = filteredRows.filter((row) => selectedIds.includes(row.id));
  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.id));

  function updateRow(id, key, value) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== id) return row;
        const nextValue = columns.find((column) => column.key === key)?.type === 'number' ? value.replace(/[^\d]/g, '') : value;
        const nextRow = { ...row, [key]: nextValue };

        if (row.status === 'error') return { ...nextRow, status: 'draft' };
        if (row.status === 'update-error') return { ...nextRow, status: 'dirty' };
        if (row.status === 'draft' || row.status === 'saving') return nextRow;
        return { ...nextRow, status: 'dirty' };
      }),
    );
    setMessage('Rows save after validation when the row loses focus.');
  }

  function addRows() {
    const count = Math.max(1, Number(rowCount) || 1);
    setRows((currentRows) => [...Array.from({ length: count }, createDraftRow), ...currentRows]);
    setMessage(`${count} empty draft row${count === 1 ? '' : 's'} added. Complete all fields to save.`);
  }

  async function saveDraftRow(rowToSave) {
    const validation = validateRow(rowToSave);

    if (!validation.isValid) {
      const hasAnyValue = columns.some((column) => String(rowToSave[column.key]).trim() !== '');

      if (hasAnyValue) {
        setMessage(`Complete the draft row before saving: ${validation.errors.join(', ')}.`);
      }

      return;
    }

    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowToSave.id ? { ...row, status: 'saving' } : row)),
    );

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Unable to save row.'));
      }

      const createdRows = await response.json();
      const createdRow = normalizeApiEmployee(createdRows[0]);

      setRows((currentRows) =>
        currentRows.map((row) => (row.id === rowToSave.id ? createdRow : row)),
      );
      setMessage(`Saved ${createdRow.name} to MongoDB.`);
    } catch (error) {
      setRows((currentRows) =>
        currentRows.map((row) => (row.id === rowToSave.id ? { ...row, status: 'error' } : row)),
      );
      setMessage(error.message);
    }
  }

  async function updateSavedRow(rowToSave) {
    if (!selectedIdsRef.current.includes(rowToSave.id)) {
      setMessage('Select the edited row before leaving it to save changes.');
      return;
    }

    const validation = validateRow(rowToSave);

    if (!validation.isValid) {
      setMessage(`Fix the selected row before saving: ${validation.errors.join(', ')}.`);
      return;
    }

    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowToSave.id ? { ...row, status: 'updating' } : row)),
    );

    try {
      const response = await fetch(`/api/employees/${rowToSave.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Unable to update row.'));
      }

      const updatedRow = normalizeApiEmployee(await response.json());

      setRows((currentRows) =>
        currentRows.map((row) => (row.id === rowToSave.id ? updatedRow : row)),
      );
      setMessage(`Updated ${updatedRow.name} in MongoDB.`);
    } catch (error) {
      setRows((currentRows) =>
        currentRows.map((row) => (row.id === rowToSave.id ? { ...row, status: 'update-error' } : row)),
      );
      setMessage(error.message);
    }
  }

  function handleRowBlur(event, rowId) {
    if (event.currentTarget.contains(event.relatedTarget)) return;

    window.setTimeout(() => {
      const latestRow = rowsRef.current.find((row) => row.id === rowId);

      if (!latestRow) return;

      if (isDraftRow(latestRow)) {
        saveDraftRow(latestRow);
        return;
      }

      if (isDirtySavedRow(latestRow)) {
        updateSavedRow(latestRow);
      }
    }, 0);
  }

  function handleRowFocus(event, row) {
    if (event.currentTarget.contains(event.relatedTarget)) return;

    selectRow(row.id);

    if (isDirtySavedRow(row)) {
      setMessage('Leave this selected row to save changes.');
      return;
    }

    if (isDraftRow(row)) {
      setMessage('Complete all required fields, then leave the row to save.');
    }
  }

  function selectRow(id) {
    setSelectedIds((currentIds) => (currentIds.includes(id) ? currentIds : [...currentIds, id]));
  }

  function toggleRow(id) {
    setSelectedIds((currentIds) =>
      currentIds.includes(id) ? currentIds.filter((selectedId) => selectedId !== id) : [...currentIds, id],
    );
  }

  function toggleFilteredRows() {
    if (allFilteredSelected) {
      setSelectedIds((currentIds) => currentIds.filter((id) => !filteredRows.some((row) => row.id === id)));
      return;
    }

    setSelectedIds((currentIds) => Array.from(new Set([...currentIds, ...filteredRows.map((row) => row.id)])));
  }

  function deleteSelectedRows() {
    if (selectedFilteredRows.length === 0) {
      setMessage('Select at least one visible row to delete.');
      return;
    }

    if (!window.confirm(`Delete ${selectedFilteredRows.length} selected row(s)?`)) return;

    const deleteIds = new Set(selectedFilteredRows.map((row) => row.id));
    setRows((currentRows) => currentRows.filter((row) => !deleteIds.has(row.id)));
    setSelectedIds((currentIds) => currentIds.filter((id) => !deleteIds.has(id)));
    setMessage('Selected visible rows deleted.');
  }

  function deleteAllVisibleRows() {
    if (filteredRows.length === 0) {
      setMessage('No visible rows to delete.');
      return;
    }

    if (!window.confirm(`Delete all ${filteredRows.length} visible row(s)?`)) return;

    const deleteIds = new Set(filteredRows.map((row) => row.id));
    setRows((currentRows) => currentRows.filter((row) => !deleteIds.has(row.id)));
    setSelectedIds((currentIds) => currentIds.filter((id) => !deleteIds.has(id)));
    setMessage('All visible rows deleted.');
  }

  function openImport(mode) {
    importModeRef.current = mode;
    fileInputRef.current?.click();
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const importedRows = await parseWorkbook(file);
      const { errors, validRows } = validateImportedRows(importedRows);

      if (errors.length > 0) {
        setMessage(errors.slice(0, 3).join(' '));
        return;
      }

      const mode = importModeRef.current === 'replace' ? 'replace' : 'append';
      const response = await fetch('/api/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, rows: validRows }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Unable to import rows.'));
      }

      const result = await response.json();
      const savedRows = result.rows.map(normalizeApiEmployee);

      if (mode === 'replace') {
        setRows(savedRows);
        setSelectedIds([]);
        setMessage(`${savedRows.length} rows imported and replaced existing data in MongoDB.`);
        return;
      }

      setRows((currentRows) => [...currentRows, ...savedRows]);
      setMessage(`${savedRows.length} rows imported to MongoDB.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function copySelectedRows() {
    if (selectedFilteredRows.length === 0) {
      setMessage('Select at least one visible row to copy.');
      return;
    }

    const text = selectedFilteredRows
      .map((row) => columns.map((column) => row[column.key]).join('\t'))
      .join('\n');
    navigator.clipboard.writeText(text);
    setMessage(`${selectedFilteredRows.length} selected row(s) copied.`);
  }

  return (
    <main className="app">
      <section className="toolbar" aria-label="Table tools">
        <div>
          <h1>Editable Employee Table</h1>
          <p>{rows.length} total rows, {filteredRows.length} visible</p>
        </div>

        <label className="search">
          <Search size={18} />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter rows"
            type="search"
          />
        </label>

        <div className="row-add">
          <input
            aria-label="Rows to add"
            min="1"
            onChange={(event) => setRowCount(event.target.value)}
            type="number"
            value={rowCount}
          />
          <button onClick={addRows} type="button" title="Add rows">
            <Plus size={18} />
            Add
          </button>
        </div>

        <button onClick={() => openImport('append')} type="button" title="Import and append">
          <FilePlus2 size={18} />
          Import Add
        </button>
        <button onClick={() => openImport('replace')} type="button" title="Import and replace">
          <FileUp size={18} />
          Import Replace
        </button>
        <button onClick={() => exportRows(selectedFilteredRows, 'selected-employees.xlsx')} type="button" title="Export selected rows">
          <Download size={18} />
          Export Selected
        </button>
        <button onClick={() => exportRows(filteredRows, 'employees.xlsx')} type="button" title="Export visible rows">
          <Download size={18} />
          Export All
        </button>
        <button onClick={copySelectedRows} type="button">
          Copy Selected
        </button>
        <button className="danger" onClick={deleteSelectedRows} type="button" title="Delete selected rows">
          <Trash2 size={18} />
          Delete Selected
        </button>
        <button className="danger" onClick={deleteAllVisibleRows} type="button" title="Delete all visible rows">
          <Trash2 size={18} />
          Delete All
        </button>

        <input
          accept=".xlsx,.xls"
          hidden
          onChange={handleImport}
          ref={fileInputRef}
          type="file"
        />
      </section>

      {message && <div className="notice" role="status">{message}</div>}

      <section className="table-wrap" aria-label="Editable employees">
        <table>
          <thead>
            <tr>
              <th className="select-cell">
                <input
                  aria-label="Select all visible rows"
                  checked={allFilteredSelected}
                  onChange={toggleFilteredRows}
                  type="checkbox"
                />
              </th>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                className={row.status ? `row-${row.status}` : undefined}
                key={row.id}
                onBlur={(event) => handleRowBlur(event, row.id)}
                onClick={() => selectRow(row.id)}
                onFocus={(event) => handleRowFocus(event, row)}
                title={isDraftRow(row) ? 'Complete all fields to save this row.' : undefined}
              >
                <td className="select-cell">
                  <input
                    aria-label={`Select ${row.name || 'row'}`}
                    checked={selectedIds.includes(row.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggleRow(row.id)}
                    type="checkbox"
                  />
                </td>
                {columns.map((column) => (
                  <td key={column.key}>
                    <input
                      disabled={row.status === 'saving' || row.status === 'updating'}
                      inputMode={column.type === 'number' ? 'numeric' : undefined}
                      onChange={(event) => updateRow(row.id, column.key, event.target.value)}
                      placeholder={isDraftRow(row) ? 'Required' : undefined}
                      type="text"
                      value={row[column.key]}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {isLoadingRows && <div className="empty">Loading rows from MongoDB...</div>}
        {!isLoadingRows && filteredRows.length === 0 && <div className="empty">No rows match the current filter.</div>}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
