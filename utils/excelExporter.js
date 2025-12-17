const ExcelJS = require('exceljs');

class ExcelExporter {
  async exportToExcel(resumeData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Resume Data');

    // Define columns
    worksheet.columns = [
      { header: 'File Name', key: 'fileName', width: 30 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Location', key: 'location', width: 25 },
      { header: 'Skills', key: 'skills', width: 50 },
      { header: 'Education', key: 'education', width: 50 },
      { header: 'Experience', key: 'experience', width: 50 },
      { header: 'Upload Date', key: 'uploadedAt', width: 20 }
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4B5563' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data
    if (Array.isArray(resumeData)) {
      resumeData.forEach(resume => {
        worksheet.addRow({
          fileName: resume.fileName,
          name: resume.extractedData?.name || '',
          email: resume.extractedData?.email || '',
          phone: resume.extractedData?.phone || '',
          location: resume.extractedData?.location || '',
          skills: resume.extractedData?.skills?.join(', ') || '',
          education: resume.extractedData?.education?.join('; ') || '',
          experience: resume.extractedData?.experience?.join('; ') || '',
          uploadedAt: new Date(resume.uploadedAt).toLocaleDateString()
        });
      });
    } else {
      // Single resume
      worksheet.addRow({
        fileName: resumeData.fileName,
        name: resumeData.extractedData?.name || '',
        email: resumeData.extractedData?.email || '',
        phone: resumeData.extractedData?.phone || '',
        location: resumeData.extractedData?.location || '',
        skills: resumeData.extractedData?.skills?.join(', ') || '',
        education: resumeData.extractedData?.education?.join('; ') || '',
        experience: resumeData.extractedData?.experience?.join('; ') || '',
        uploadedAt: new Date(resumeData.uploadedAt).toLocaleDateString()
      });
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.alignment = { wrapText: true, vertical: 'top' };
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

module.exports = new ExcelExporter();
