# Customer CSV/Excel Import Guide

## Overview

The SGH CRM system now supports bulk customer import via CSV or Excel files. This allows you to quickly add multiple customers at once instead of adding them one by one.

---

## Backend API Endpoints

### 1. Import Customers from File
**POST** `/api/v1/customers/import/file`

Upload a CSV or Excel file to import customers.

- **Content-Type**: `multipart/form-data`
- **Authentication**: Required (Bearer token)
- **File Field Name**: `file`
- **Supported Formats**: `.csv`, `.xlsx`, `.xls`

**Response:**
```json
{
  "success": 10,
  "failed": 2,
  "errors": [
    {
      "name": "John Doe",
      "phone": "123456",
      "error": "Invalid phone number \"123456\""
    }
  ]
}
```

---

### 2. Download Sample CSV Template
**GET** `/api/v1/customers/import/sample-csv`

Downloads a sample CSV file with the correct format.

- **Authentication**: Required (Bearer token)
- **Response**: CSV file download

---

### 3. Download Sample Excel Template
**GET** `/api/v1/customers/import/sample-excel`

Downloads a sample Excel file with the correct format.

- **Authentication**: Required (Bearer token)
- **Response**: Excel file download

---

## File Format

### Required Columns
- **name** - Customer full name (required)
- **phone** - Phone number, minimum 10 digits (required)

### Optional Columns
- **email** - Email address
- **creditAmount** - Initial credit balance (number, default: 0)
- **notes** - Additional notes about the customer

### Example CSV:
```csv
name,phone,email,creditAmount,notes
John Doe,9876543210,john@example.com,0,VIP Customer
Jane Smith,9123456789,jane@example.com,500,Regular customer with initial credit
Bob Wilson,9988776655,,0,
```

### Example Excel:
| name | phone | email | creditAmount | notes |
|------|-------|-------|--------------|-------|
| John Doe | 9876543210 | john@example.com | 0 | VIP Customer |
| Jane Smith | 9123456789 | jane@example.com | 500 | Regular customer with initial credit |
| Bob Wilson | 9988776655 | | 0 | |

---

## Important Notes

### Column Headers
- Column headers are **case-insensitive**
- Accepted variations: `name`, `Name`, `NAME`
- Whitespace in headers like `Credit Amount` is also supported

### Phone Number Validation
- Must be at least 10 digits
- Can include country codes
- Special characters will be preserved

### Blank/Empty Rows
- **Completely empty rows are automatically skipped** (no error reported)
- Rows with partial data but missing required fields will be reported as errors
- The import continues processing all rows even if some fail

### Row Processing Behavior
- ✅ **Valid rows** - Imported successfully
- ⚠️ **Invalid rows** - Skipped with detailed error message
- ➖ **Empty rows** - Silently skipped (no error)
- The system processes ALL rows and reports results at the end

### Duplicate Prevention
- Customers with duplicate phone numbers will be skipped
- The error will be reported in the import results

### Initial Credit Amount
- If you specify a `creditAmount` greater than 0, the system will:
  - Create the customer with the specified amount in their **pending credit** field
  - The credit appears immediately in the customer's profile
  - No past entry is created - it's stored as pending credit only
  - Example: `creditAmount: 500` creates a customer with ₹500 pending credit

---

## Frontend Usage

### Using the Import Feature

1. Navigate to the **Customers** page
2. Click the **Import** button in the top right
3. Choose to download a sample template (CSV or Excel)
4. Fill in your customer data following the template format
5. Click the upload area or drag & drop your file
6. Click **Import Customers**
7. View the import results showing:
   - Number of successful imports
   - Number of failed imports
   - Detailed error messages for failures

### Features
- ✅ Drag & drop file upload
- ✅ Support for both CSV and Excel files
- ✅ Download sample templates
- ✅ Real-time validation feedback
- ✅ Detailed error reporting
- ✅ Automatic page refresh after successful import

---

## Testing the Import

### Using Postman or cURL

```bash
curl -X POST http://localhost:3000/api/v1/customers/import/file \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/customers.csv"
```

### Download Sample Files

**CSV Template:**
```bash
curl -X GET http://localhost:3000/api/v1/customers/import/sample-csv \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o sample_customers.csv
```

**Excel Template:**
```bash
curl -X GET http://localhost:3000/api/v1/customers/import/sample-excel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o sample_customers.xlsx
```

---

## Common Issues & Solutions

### Issue: "Invalid file type"
**Solution**: Make sure your file has a `.csv`, `.xlsx`, or `.xls` extension.

### Issue: "Row X: Name and Phone are required fields"
**Solution**: Every row must have both name and phone columns filled.

### Issue: "Row X: Invalid phone number"
**Solution**: Phone numbers must be at least 10 digits long.

### Issue: "Customer with this phone already exists"
**Solution**: A customer with this phone number is already in the database. Update the existing customer or use a different phone number.

---

## Technical Implementation

### Backend (NestJS)
- **File Parser**: Uses `xlsx` library for Excel files and `csv-parser` for CSV files
- **Validation**: Validates each row before import
- **Error Handling**: Collects and returns all errors without stopping the import
- **Transaction Safety**: Each customer is created in a separate transaction

### Frontend (Next.js)
- **Upload Component**: Custom dialog with drag & drop support
- **File Validation**: Client-side validation for file types
- **Progress Feedback**: Real-time upload status and results
- **Error Display**: Detailed error messages for failed imports

---

## Sample Files Location

Sample files are dynamically generated and can be downloaded from:
- Frontend: Click "CSV Template" or "Excel Template" in the import dialog
- Backend: Use the API endpoints mentioned above

---

## Need Help?

If you encounter any issues:
1. Download and examine the sample files
2. Ensure your file matches the exact format
3. Check the error messages in the import results
4. Verify phone numbers are valid and unique

For additional support, check the application logs or contact the development team.
