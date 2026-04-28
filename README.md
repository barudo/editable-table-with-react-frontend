# Editable Table With React Front End

An editable data table application with a React frontend, a Node.js/Express backend, and MongoDB for persistent storage.

The application is intended to manage employee-style tabular data with inline editing, row selection, Excel import/export, and database synchronization when table data changes.

## Tech Stack

- Frontend: React
- Backend: Node.js with Express
- Database: MongoDB
- File support: Excel import/export

## Core Features

- Add one or more draft rows from the toolbar.
- Edit existing row data inline.
- Select one or more rows for copy, export, update, or delete actions.
- Delete selected rows after showing a confirmation warning.
- Delete all visible rows after showing a confirmation warning.
- Save new rows to MongoDB after the draft row is completed and loses focus.
- Save edited rows to MongoDB after a selected edited row loses focus.
- Import rows from an Excel file and append them to the existing table with **Import Add**.
- Import rows from an Excel file and replace all existing table data with **Import Replace**.
- Export selected rows to an Excel file with **Export Selected**.
- Export all currently visible rows to an Excel file with **Export All**.
- Copy selected rows to the clipboard as tab-separated text with **Copy Selected**.
- Validate uploaded Excel data and show an error when the uploaded data has the wrong structure or invalid values.
- When table data is filtered, row actions should apply only to the filtered data set where applicable.

## Expected Table Columns

The table should match the attached `Book1.xlsx` structure:

| Column | Description |
| --- | --- |
| `employee id` | Employee identifier |
| `name` | Employee name |
| `city` | Employee city |
| `country` | Employee country |
| `age` | Employee age |

The provided sample file is available at `attachments/Book1.xlsx`. In that workbook, the table starts at columns `C:G`, with headers on row `9` and data rows beginning on row `10`. Import logic should locate the expected headers instead of assuming the first row contains column names.

## Functional Requirements

### Row Management

- Users can add a single row or multiple rows.
- Users can modify cell values directly in the table.
- Changes are persisted to MongoDB only after data is changed.
- Users can select rows for bulk actions.
- Draft rows are saved only after all required fields are valid.
- Existing rows must be selected before edits are saved when the row loses focus.

### Delete Actions

- Deleting selected rows requires a confirmation warning.
- Deleting all rows requires a confirmation warning.
- If the table is filtered, delete actions should affect only the intended filtered rows.

### Excel Import

- **Import Add** opens a file picker, validates the uploaded Excel rows, and appends valid rows to MongoDB.
- **Import Replace** opens a file picker, validates the uploaded Excel rows, deletes existing records, and inserts the uploaded rows.
- Uploaded files must be validated before data is saved.
- Invalid files or files with incorrect columns/data should show an error.
- Local standalone MongoDB is supported for imports. The backend import route does not require MongoDB replica-set transactions.

### Excel Export

- **Export Selected** downloads only selected visible rows as an Excel file.
- **Export All** downloads all currently visible rows as an Excel file.
- If the table is filtered, exports should respect the current filtered data where applicable.

### Clipboard Copy

- **Copy Selected** copies selected visible rows to the clipboard.
- Copied rows are tab-separated, so they can be pasted directly into Excel, Google Sheets, Numbers, or a text editor.
- The copied column order is `employee id`, `name`, `city`, `country`, and `age`.

## Recent Updates

- Updated the Express backend default port from `5000` to `5050` so it matches the Vite proxy and documented development setup.
- Updated `server/.env` to use local MongoDB:

```env
MONGODB_URI=mongodb://localhost:27017/editable-table
```

- Confirmed local MongoDB is available on `localhost:27017`.
- Confirmed the backend starts on `http://localhost:5050` after pointing the app to local MongoDB.
- Fixed the Excel import endpoint for local standalone MongoDB by removing transaction usage from `POST /api/employees/import`.
- Verified `GET /api/health`, `GET /api/employees`, and `POST /api/employees/import` return successful responses against the local backend.
- Verified linting with `npm run lint`.

## Acceptance Criteria

- The application is built using React for the frontend, Node.js/Express for the backend, and MongoDB for persistent storage.
- The table supports adding one or more new rows and inline editing of existing row data.
- The table allows selection and deletion of one or more rows with a confirmation warning.
- The table allows deletion of all rows with a confirmation warning.
- The table supports importing data from an Excel file to either add new rows or completely replace all existing data.
- The table supports exporting selected rows or all rows as an Excel file.
- Optional: table columns exactly match the structure from `Book1.xlsx`: employee id, name, city, country, and age.

## Suggested Project Structure

```text
.
├── attachments/     # Sample source files
├── src/             # Vite React frontend
├── server/          # Node.js/Express backend
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── Book1.xlsx       # Example Excel structure, if copied from attachments
```

## Suggested Environment Variables

Create a backend environment file from the example:

```bash
cp server/.env.example server/.env
```

Default values:

```env
PORT=5050
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/editable-table
```

## Getting Started

Install dependencies:

```bash
npm install
```

Start MongoDB locally or update `MONGODB_URI` in `server/.env`.

For the local Docker or local MongoDB setup used by this project, `server/.env` should contain:

```env
PORT=5050
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/editable-table
```

Seed the employees collection from the sample Excel file:

```bash
npm run seed:employees
```

Start both the React frontend and Express backend together:

```bash
npm run dev
```

This runs:

- React frontend: `http://localhost:5173`
- Express backend: `http://localhost:5050`

If port `5173` is already in use, Vite may start the frontend on the next available port, such as `http://localhost:5174/`. Use the local URL printed by Vite.

You can also run them separately in two terminals:

```bash
npm run dev:client
```

```bash
npm run dev:server
```

Open the local URL printed by Vite, usually `http://localhost:5173/`.

Build the frontend for production:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

The Vite dev server proxies `/api` requests to `http://localhost:5050`.

## Backend API

Health check:

```http
GET /api/health
```

Employees:

```http
GET /api/employees?search=value
POST /api/employees
PUT /api/employees/:id
PATCH /api/employees/:id
DELETE /api/employees
```

Import and export payload helpers:

```http
POST /api/employees/import
POST /api/employees/export
```

Example employee payload:

```json
{
  "employeeId": 1,
  "name": "Reeta Winspeare",
  "city": "Potoru",
  "country": "Sierra Leone",
  "age": 3
}
```

Append or replace imported rows:

```json
{
  "mode": "append",
  "rows": [
    {
      "employeeId": 1,
      "name": "Reeta Winspeare",
      "city": "Potoru",
      "country": "Sierra Leone",
      "age": 3
    }
  ]
}
```

Delete selected rows:

```json
{
  "ids": ["mongodb-object-id"]
}
```

Delete all rows matching the current filter:

```json
{
  "all": true,
  "search": "philippines"
}
```
