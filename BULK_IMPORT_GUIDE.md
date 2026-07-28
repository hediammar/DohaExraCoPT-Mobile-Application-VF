# 📊 Bulk Import Projects Guide

## Overview
The Bulk Import Projects feature allows you to import multiple projects from an Excel file directly into the Supabase database. Each field is in a separate column, making it easy to work with in Excel and other spreadsheet applications. The system automatically matches customer names to customer IDs.

## 🎯 Features

### ✅ What's Included
- **Excel Template Download**: Pre-formatted template with each field in a separate column
- **Customer Name Matching**: Automatically converts customer names to customer IDs
- **Data Validation**: Comprehensive validation before import
- **Progress Tracking**: Real-time progress during import
- **Error Handling**: Detailed error reporting for failed imports
- **RBAC Integration**: Respects user permissions
- **Batch Processing**: Handles large datasets efficiently

### 📋 Excel Format (Column-Based)
The Excel file should have the following columns, with each field in a separate column:

| Column | Required | Type | Description | Example | Empty Handling |
|--------|----------|------|-------------|---------|----------------|
| `name` | ✅ Yes | String | Project name | Project Alpha | Error if empty |
| `customer_name` | ❌ No | String | Customer name (must match database) | Al Rayyan Construction | NULL if empty |
| `location` | ❌ No | String | Project location | Doha, Qatar | NULL if empty |
| `start_date` | ❌ No | Date | Project start date (YYYY-MM-DD) | 2024-01-15 | NULL if empty |
| `end_date` | ❌ No | Date | Project end date (YYYY-MM-DD) | 2024-06-30 | NULL if empty |
| `status` | ❌ No | String | Project status | active | Defaults to 'active' if empty |
| `estimated_cost` | ❌ No | Number | Estimated cost in currency units | 500000 | NULL if empty or 0 |
| `estimated_panels` | ❌ No | Number | Estimated number of panels | 1200 | NULL if empty or 0 |

## 🚀 How to Use

### Step 1: Download Template
1. Navigate to the Bulk Import Projects page
2. Click "Download Excel Template"
3. Open the downloaded .xlsx file in Excel - each field will be in its own column

### Step 2: Prepare Your Data
1. Fill in your project data following the template format
2. **Important**: Use exact customer names that exist in the database
3. Use YYYY-MM-DD format for dates
4. Each field should be in its own column
5. Save as Excel file (.xlsx)

### Step 3: Upload and Validate
1. Click "Choose File" and select your Excel file
2. Review the validation results
3. Fix any errors or warnings shown
4. Re-upload if needed

### Step 4: Import
1. Click "Import Projects" button
2. Monitor the progress bar
3. Review the import results
4. Check for any failed imports

## 🔍 Validation Rules

### Required Fields
- **Project Name**: Must not be empty

### Data Validation
- **Customer Name**: If provided, must match an existing customer in the database
- **Dates**: Must be in YYYY-MM-DD format
- **Numbers**: Estimated cost and panels must be numeric
- **Status**: Should be one of: active, inactive, completed, on-hold

### Customer Matching
- Customer names are matched case-insensitively
- Exact matches are required (no fuzzy matching)
- Available customers are displayed on the page

### Empty Field Handling
- **Required Fields**: Project name cannot be empty
- **Optional Fields**: Empty cells are converted to NULL in the database
- **Customer Name**: Optional field - if provided, must match existing customer; if empty, customer_id becomes NULL
- **Numeric Fields**: Empty cells or zero values become NULL
- **Date Fields**: Empty cells become NULL
- **Status Field**: Empty cells default to 'active'
- **String Fields**: Empty cells become NULL

## 📊 Example Excel Content (Column Format)

When opened in Excel, the template will display as:

| name | customer_name | location | start_date | end_date | status | estimated_cost | estimated_panels |
|------|---------------|----------|------------|----------|--------|----------------|------------------|
| Project Alpha | Al Rayyan Construction | Doha, Qatar | 2024-01-15 | 2024-06-30 | active | 500000 | 1200 |
| Project Beta | Qatar Building Solutions | Al Wakrah, Qatar | 2024-02-01 | 2024-08-15 | active | 750000 | 1800 |
| Project Gamma | Doha Development Corp | West Bay, Qatar | 2024-03-01 | 2024-09-30 | active | 300000 | 800 |

## 🔐 Permissions

### Required Permissions
- Users must have `canCreate` permission for projects
- Available roles with import permission:
  - Administrator
  - Data Entry

### Role-Based Access
- **Administrator**: Full access to bulk import
- **Data Entry**: Full access to bulk import
- **Customer**: No access to bulk import
- **Other Roles**: Read-only access to projects

## ⚠️ Common Issues

### Customer Not Found
**Problem**: "Customer 'XYZ' not found in database"
**Solution**: 
1. Check the available customers list on the page
2. Use exact customer names (case doesn't matter)
3. Create the customer first if it doesn't exist

### Invalid Date Format
**Problem**: "Invalid start date format"
**Solution**: Use YYYY-MM-DD format (e.g., "2024-01-15")

### Permission Denied
**Problem**: "You do not have permission to create projects"
**Solution**: Contact your administrator to grant appropriate permissions

### Import Failures
**Problem**: Some projects failed to import
**Solution**:
1. Check the error messages in the import results
2. Fix the data issues
3. Re-import the corrected data

### Excel Format Issues
**Problem**: Data not parsing correctly
**Solution**: 
1. Ensure each field is in its own column
2. Use the provided Excel template
3. Save as .xlsx format
4. Check that the first row contains column headers

## 🛠️ Technical Details

### Database Schema
The import creates records in the `projects` table with the following structure:

```sql
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NULL,
  customer_id uuid NULL,
  location character varying NULL,
  start_date date NULL,
  end_date date NULL,
  status character varying NULL,
  estimated_cost integer NULL,
  estimated_panels integer NULL,
  created_at timestamp with time zone NULL,
  updated_at timestamp with time zone NULL,
  user_id uuid NULL
);
```

### Customer ID Resolution
The system performs the following steps:
1. Reads customer names from Excel
2. Queries the `customers` table for matching names
3. Uses the customer's UUID as `customer_id`
4. Fails import if customer not found

### Error Handling
- **Validation Errors**: Prevent import of invalid data
- **Database Errors**: Logged and reported to user
- **Network Errors**: Retry mechanism for failed requests
- **Permission Errors**: Clear messaging about access rights

## 📈 Performance

### Batch Processing
- Processes projects one by one for detailed error reporting
- Progress bar shows real-time status
- Can handle hundreds of projects efficiently

### Memory Usage
- Excel parsing is done in chunks
- Large files are processed efficiently
- No memory leaks during import

## 🔄 Troubleshooting

### File Upload Issues
1. Ensure file is Excel format (.xlsx or .xls)
2. Check file size (should be under 10MB)
3. Verify file encoding (UTF-8 recommended)
4. Make sure each field is in its own column

### Excel Compatibility
1. **To create Excel file**: 
   - Download the template
   - Edit the data in Excel
   - Save as .xlsx format
2. **To open Excel file**:
   - File → Open → Select your .xlsx file
   - Excel will display each field in its own column

### Import Stuck
1. Check network connection
2. Refresh the page and try again
3. Contact support if issue persists

### Data Not Appearing
1. Check import results for errors
2. Verify database connection
3. Check user permissions

## 📞 Support

If you encounter issues:
1. Check the validation results carefully
2. Review the error messages in import results
3. Ensure all customer names exist in the database
4. Contact your system administrator for permission issues

---

**Note**: This feature is designed for bulk data migration and should be used carefully. Always validate your data before importing large datasets. The Excel format provides better formatting, data validation, and user experience compared to CSV files. 